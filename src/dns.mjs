import { join } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import {
  writeLines,
  isIPv6Address,
  normalizeIPAddress,
  isLinkLocal
} from "./utils.mjs";
import { DNSRecord, dnsFullName, dnsFormatParameters } from "./dns-utils.mjs";
import { Base } from "./base.mjs";
import { addType } from "./types.mjs";
import { serviceAddresses } from "./service.mjs";
import { subnets } from "./subnet.mjs";

const DNSServiceTypeDefinition = {
  name: "dns",
  owners: ["location", "owner", "network", "cluster", "root"],
  priority: 0.1,
  properties: {
    source: { type: "network", collection: true, writeable: true },
    trusted: { type: "network", collection: true, writeable: true },
    hasSVRRecords: { type: "boolean", collection: false, writeable: true },
    hasCatalog: { type: "boolean", collection: false, writeable: true },
    hasLinkLocalAdresses: {
      type: "boolean",
      collection: false,
      writeable: true
    },
    notify: { type: "boolean", collection: false, writeable: true },
    recordTTL: { type: "string", collection: false, writeable: true },
    refresh: { type: "string", collection: false, writeable: true },
    retry: { type: "string", collection: false, writeable: true },
    expire: { type: "string", collection: false, writeable: true },
    minimum: { type: "string", collection: false, writeable: true },
    allowedUpdates: { type: "string", collection: true, writeable: true }
  }
};

const DNS_SERVICE_FILTER = { type: DNSServiceTypeDefinition.name };

export class DNSService extends Base {
  allowedUpdates = [];
  recordTTL = "1W";
  hasSVRRecords = true;
  hasCatalog = true;
  hasLinkLocalAdresses = true;
  notify = true;
  #source = [];
  #trusted = [];

  refresh = 36000;
  retry = 72000;
  expire = 600000;
  minimum = 60000;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return DNSServiceTypeDefinition;
  }

  constructor(owner, data) {
    if (!data.name) {
      data.name = DNSServiceTypeDefinition.name; // TODO
    }
    super(owner, data);
    this.read(data, DNSServiceTypeDefinition);

    owner.addObject(this);
  }

  get soaUpdates() {
    return [this.refresh, this.retry, this.expire, this.minimum];
  }

  set trusted(value) {
    this.#trusted.push(value);
  }

  get trusted() {
    return this.#trusted;
  }

  set source(value) {
    this.#source.push(value);
  }

  get source() {
    return this.#source;
  }

  *findServices(filter) {
    yield* this.owner.findServices(filter);

    for (const s of this.source) {
      yield* s.findServices(filter);
    }
  }

  get systemdConfig() {
    return [
      "Resolve",
      {
        DNS: serviceAddresses(this, {
          ...DNS_SERVICE_FILTER,
          priority: "<10"
        }).join(" "),
        FallbackDNS: serviceAddresses(this, {
          ...DNS_SERVICE_FILTER,
          priority: ">=10"
        }).join(" "),
        Domains: [...this.domains].join(" "),
        DNSSEC: "no",
        MulticastDNS: "yes",
        LLMNR: "no"
      }
    ];
  }

  async *preparePackages(stagingDir) {
    const name = this.owner.name;
    const p1 = join(stagingDir, "p1");

    const result = {
      sources: [new FileContentProvider(p1 + "/")[Symbol.asyncIterator]()],
      outputs: this.outputs,
      properties: {
        name: `named-${name}`,
        description: `named definitions for ${this.fullName}`,
        access: "private"
      }
    };

    const options = [
      "forwarders {",
      ...serviceAddresses(this.source, DNS_SERVICE_FILTER).map(a => `  ${a};`),
      "};"
    ];
    await writeLines(join(p1, "etc/named.d/options"), `${name}.conf`, options);

    const category = [
      "acl trusted {",
      ...Array.from(subnets(this.trusted)).map(subnet => `  ${subnet.name};`),
      "};"
    ];

    await writeLines(
      join(p1, "etc/named.d/categories"),
      `${name}.conf`,
      category
    );

    if (options.length > 2 || category.length > 2) {
      yield result;
    }

    const p2 = join(stagingDir, "p2");

    result.properties = {
      name: `named-zones-${name}`,
      description: `zone definitions for ${this.fullName}`,
      dependencies: ["mf-named"],
      replaces: ["mf-named-zones"],
      access: "private"
    };

    result.sources = [
      new FileContentProvider(p2 + "/")[Symbol.asyncIterator]()
    ];

    await generateZoneDefs(this, p2);

    yield result;
  }
}

async function generateZoneDefs(dns, targetDir) {
  const ttl = dns.recordTTL;
  const updates = [Math.ceil(Date.now() / 1000), ...dns.soaUpdates].join(" ");

  for (const domain of dns.domains) {
    const zones = [];
    const records = new Set();

    const nameService = dns.findService(DNS_SERVICE_FILTER);
    const rname = dns.administratorEmail.replace(/@/, ".");

    let maxKeyLength;

    for (const mail of dns.owner.findServices({ type: "smtp" })) {
      records.add(
        DNSRecord("@", "MX", mail.priority, dnsFullName(mail.domainName))
      );
    }

    console.log(`${nameService}`, nameService.ipAddressOrDomainName);
    //console.log(dns.owner.fullName, domain, nameService.domainName, rname);
    const reverseZones = new Map();

    const SOARecord = DNSRecord(
      "@",
      "SOA",
      dnsFullName(nameService.domainName),
      dnsFullName(rname),
      `(${updates})`
    );

    const NSRecord = DNSRecord(
      "@",
      "NS",
      dnsFullName(nameService.ipAddressOrDomainName)
    );

    const ALPNRecord = DNSRecord(
      "@",
      "HTTPS",
      1,
      ".",
      dnsFormatParameters({ alpn: "h3" })
    );

    const zone = {
      id: domain,
      type: "plain",
      file: `${dns.owner.name}/${domain}.zone`,
      records: new Set([SOARecord, NSRecord, ALPNRecord, ...records])
    };
    zones.push(zone);

    const catalogZone = {
      id: `catalog.${domain}`,
      type: "catalog",
      file: `${dns.owner.name}/catalog.${domain}.zone`,
      records: new Set([
        SOARecord,
        NSRecord,
        DNSRecord(dnsFullName(`version.catalog.${domain}`), "TXT", '"1"')
      ])
    };

    const configs = {
      plain: { name: `${domain}.zone.conf`, content: [] }
    };

    if (dns.hasCatalog) {
      zones.push(catalogZone);
      configs.catalog = { name: `catalog.${domain}.zone.conf`, content: [] };
    }

    const hosts = new Set();
    const addresses = new Set();

    for await (const {
      address,
      subnet,
      networkInterface
    } of dns.owner.networkAddresses()) {
      const host = networkInterface.host;
      const domainName = host.domainNameIn(domain);

      if (domainName) {
        if (
          !addresses.has(address) &&
          (dns.hasLinkLocalAdresses || !isLinkLocal(address))
        ) {
          addresses.add(address);

          zone.records.add(
            DNSRecord(
              dnsFullName(domainName),
              isIPv6Address(address) ? "AAAA" : "A",
              normalizeIPAddress(address)
            )
          );
          if (subnet && host.domain === domain) {
            let reverseZone = reverseZones.get(subnet.address);

            if (!reverseZone) {
              const reverseArpa = reverseArpaAddress(subnet.prefix);
              reverseZone = {
                id: reverseArpa,
                type: "plain",
                file: `${dns.owner.name}/${reverseArpa}.zone`,
                records: new Set([SOARecord, NSRecord])
              };
              zones.push(reverseZone);
              reverseZones.set(subnet.address, reverseZone);
            }

            for (const domainName of host.domainNames) {
              reverseZone.records.add(
                DNSRecord(
                  dnsFullName(reverseArpaAddress(address)),
                  "PTR",
                  dnsFullName(domainName)
                )
              );
            }
          }
        }

        if (!hosts.has(host)) {
          hosts.add(host);
          for (const service of host.findServices()) {
            for (const record of service.dnsRecordsForDomainName(
              domainName,
              dns.hasSVRRecords
            )) {
              zone.records.add(record);
            }
          }
        }
      }
    }

    for (const zone of zones) {
      const content = configs[zone.type].content;

      if (zone.type !== "catalog") {
        const hash = createHmac("md5", zone.id).digest("hex");
        catalogZone.records.add(
          DNSRecord(
            `${hash}.zones.catalog.${domain}.`,
            "PTR",
            dnsFullName(zone.id)
          )
        );
      }

      content.push(`zone \"${zone.id}\" {`);
      content.push(`  type master;`);
      content.push(`  file \"${zone.file}\";`);

      content.push(
        `  allow-update { ${
          dns.allowedUpdates.length ? dns.allowedUpdates.join(";") : "none"
        }; };`
      );
      content.push(`  notify ${dns.notify ? "yes" : "no"};`);
      content.push(`};`);
      content.push("");

      maxKeyLength = 0;
      for (const r of zone.records) {
        if (r.key.length > maxKeyLength) {
          maxKeyLength = r.key.length;
        }
      }

      await writeLines(
        join(targetDir, "var/lib/named"),
        zone.file,
        [...zone.records].map(r => r.toString(maxKeyLength, ttl))
      );
    }

    for (const cfg of Object.values(configs)) {
      await writeLines(
        join(targetDir, "etc/named.d/zones"),
        cfg.name,
        cfg.content
      );
    }
  }
}

export function reverseAddress(address) {
  if (isIPv6Address(address)) {
    return normalizeIPAddress(address)
      .replaceAll(":", "")
      .split("")
      .reverse()
      .join(".");
  }

  return address.split(".").reverse().join(".");
}

export function reverseArpaAddress(address) {
  return (
    reverseAddress(address) +
    (isIPv6Address(address) ? ".ip6.arpa" : ".in-addr.arpa")
  );
}
