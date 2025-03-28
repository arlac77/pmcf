import { join } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import {
  writeLines,
  isIPv6Address,
  normalizeIPAddress,
  isLinkLocal
} from "../utils.mjs";
import { DNSRecord, dnsFullName } from "../dns-utils.mjs";
import { addType } from "../types.mjs";
import {
  Service,
  ServiceTypeDefinition,
  serviceAddresses
} from "../service.mjs";
import { subnets } from "../subnet.mjs";

const DNSServiceTypeDefinition = {
  name: "dns",
  owners: ServiceTypeDefinition.owners,
  priority: 0.1,
  properties: {
    source: { type: "network", collection: true, writeable: true },
    trusted: { type: "network", collection: true, writeable: true },
    protected: { type: "network", collection: true, writeable: true },
    open: { type: "network", collection: true, writeable: true },
    hasSVRRecords: { type: "boolean", collection: false, writeable: true },
    hasCatalog: { type: "boolean", collection: false, writeable: true },
    hasLinkLocalAdresses: {
      type: "boolean",
      collection: false,
      writeable: true
    },
    notify: { type: "boolean", collection: false, writeable: true },
    recordTTL: { type: "string", collection: false, writeable: true },
    serial: { type: "number", collection: false, writeable: true },
    refresh: { type: "string", collection: false, writeable: true },
    retry: { type: "string", collection: false, writeable: true },
    expire: { type: "string", collection: false, writeable: true },
    minimum: { type: "string", collection: false, writeable: true },
    allowedUpdates: { type: "string", collection: true, writeable: true }
  }
};

const DNS_SERVICE_FILTER = { type: DNSServiceTypeDefinition.name };

function addressList(objects) {
  return Array.from(objects).map(object =>
    typeof object === "string" ? object : object.name
  );
}

function addressesStatement(prefix, objects, generateEmpty = false) {
  const body = addressList(objects).map(name => `  ${name};`);

  if (body.length || generateEmpty) {
    return [`${prefix} {`, body, "};"];
  }

  return [];
}

export class DNSService extends Service {
  allowedUpdates = [];
  recordTTL = "1W";
  hasSVRRecords = true;
  hasCatalog = true;
  hasLinkLocalAdresses = true;
  notify = true;
  #source = [];
  #trusted = [];
  #protected = [];
  #open = [];

  serial = Math.ceil(Date.now() / 1000);
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
    super(owner, data);
    this.read(data, DNSServiceTypeDefinition);
  }

  get type() {
    return DNSServiceTypeDefinition.name;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  set protected(value) {
    this.#protected.push(value);
  }

  get protected() {
    return this.#protected;
  }

  set trusted(value) {
    this.#trusted.push(value);
  }

  get trusted() {
    return this.#trusted;
  }

  set open(value) {
    this.#open.push(value);
  }

  get open() {
    return this.#open;
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

  async *preparePackages(dir) {
    const name = this.owner.name;
    const p1 = join(dir, "p1");
    const packageData = {
      dir: p1,
      sources: [new FileContentProvider(p1 + "/")[Symbol.asyncIterator]()],
      outputs: this.outputs,
      properties: {
        name: `named-${name}`,
        description: `named definitions for ${this.fullName}`,
        access: "private"
      }
    };

    const options = addressesStatement(
      "forwarders",
      serviceAddresses(this.source, DNS_SERVICE_FILTER)
    );
    if (options.length > 2) {
      await writeLines(
        join(p1, "etc/named/options"),
        `forwarders.conf`,
        options
      );
    }

    const acls = [
      addressesStatement("acl trusted", subnets(this.trusted)),
      addressesStatement("acl protected", subnets(this.protected)),
      addressesStatement("acl open", subnets(this.open), true)
    ].flat();

    if (acls.length) {
      await writeLines(join(p1, "etc/named"), `0-acl-${name}.conf`, acls);
    }
    if (options.length || acls.length) {
      yield packageData;
    }

    const p2 = (packageData.dir = join(dir, "p2"));

    packageData.properties = {
      name: `named-zones-${name}`,
      description: `zone definitions for ${this.fullName}`,
      dependencies: ["mf-named"],
      replaces: ["mf-named-zones"],
      access: "private"
    };

    packageData.sources = [
      new FileContentProvider(
        p2 + "/",
        {
          mode: 0o644,
          owner: "named",
          group: "named"
        },
        {
          mode: 0o755,
          owner: "named",
          group: "named"
        }
      )[Symbol.asyncIterator]()
    ];

    await generateZoneDefs(this, packageData);

    yield packageData;
  }
}

async function generateZoneDefs(dns, packageData) {
  const ttl = dns.recordTTL;
  const nameService = dns.findService(DNS_SERVICE_FILTER);
  const rname = dns.administratorEmail.replace(/@/, ".");

  const SOARecord = DNSRecord(
    "@",
    "SOA",
    dnsFullName(nameService.domainName),
    dnsFullName(rname),
    `(${[...dns.soaUpdates].join(" ")})`
  );

  const NSRecord = DNSRecord(
    "@",
    "NS",
    dnsFullName(nameService.ipAddressOrDomainName)
  );

  console.log(`${nameService}`, nameService.ipAddressOrDomainName);

  const configs = [];

  const location = dns.location;

  for (const host of location.hosts()) {
    for (const domain of host.foreignDomainNames) {
      const zone = {
        id: domain,
        file: `FOREIGN/${domain}.zone`,
        records: new Set([SOARecord, NSRecord])
      };
      const config = {
        name: `${domain}.zone.conf`,
        zones: [zone]
      };
      configs.push(config);

      for (const address of host.rawAddresses) {
        zone.records.add(
          DNSRecord(
            "@",
            isIPv6Address(address) ? "AAAA" : "A",
            normalizeIPAddress(address)
          )
        );
        zone.records.add(DNSRecord("location", "TXT", host.location.name));
      }
    }
  }

  for (const domain of dns.localDomains) {
    const ownerName = dns.owner.name;
    const reverseZones = new Map();

    const config = {
      name: `${domain}.zone.conf`,
      zones: []
    };
    configs.push(config);

    const locationRecord = DNSRecord("location", "TXT", dns.location.name);

    const zone = {
      id: domain,
      file: `${ownerName}/${domain}.zone`,
      records: new Set([SOARecord, NSRecord, locationRecord])
    };
    config.zones.push(zone);

    if (dns.hasCatalog) {
      const catalogConfig = {
        name: `catalog.${domain}.zone.conf`,
        zones: []
      };
      configs.push(catalogConfig);

      zone.catalogZone = {
        id: `catalog.${domain}`,
        file: `${ownerName}/catalog.${domain}.zone`,
        records: new Set([
          SOARecord,
          NSRecord,
          DNSRecord(dnsFullName(`version.catalog.${domain}`), "TXT", '"1"')
        ])
      };
      catalogConfig.zones.push(zone.catalogZone);
    }

    const hosts = new Set();
    const addresses = new Set();

    for await (const {
      address,
      subnet,
      networkInterface,
      domainNames
    } of location.networkAddresses()) {
      const host = networkInterface.host;
      if (
        !addresses.has(address) &&
        (dns.hasLinkLocalAdresses || !isLinkLocal(address))
      ) {
        addresses.add(address);

        for (const domainName of domainNames) {
          zone.records.add(
            DNSRecord(
              dnsFullName(domainName),
              isIPv6Address(address) ? "AAAA" : "A",
              normalizeIPAddress(address)
            )
          );
        }
        if (subnet && host.domain === domain) {
          let reverseZone = reverseZones.get(subnet.address);

          if (!reverseZone) {
            const reverseArpa = reverseArpaAddress(subnet.prefix);
            reverseZone = {
              id: reverseArpa,
              type: "plain",
              file: `${ownerName}/${reverseArpa}.zone`,
              records: new Set([SOARecord, NSRecord])
            };
            config.zones.push(reverseZone);
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

        for (const foreignDomainName of host.foreignDomainNames) {
          zone.records.add(
            DNSRecord("external", "PTR", dnsFullName(foreignDomainName))
          );
        }

        for (const service of host.findServices()) {
          //for (const domainName of domainNames) {
          for (const record of service.dnsRecordsForDomainName(
            host.domainName,
            dns.hasSVRRecords
          )) {
            zone.records.add(record);
          }
          //}
        }
      }
    }
  }

  for (const config of configs) {
    console.log(`config: ${config.name}`);

    const content = [];
    for (const zone of config.zones) {
      console.log(`  zone: ${zone.id}`);

      if (zone.catalogZone) {
        const hash = createHmac("md5", zone.id).digest("hex");
        zone.catalogZone.records.add(
          DNSRecord(
            `${hash}.zones.catalog.${zone.id}.`,
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

      let maxKeyLength = 0;
      for (const r of zone.records) {
        if (r.key.length > maxKeyLength) {
          maxKeyLength = r.key.length;
        }
      }

      await writeLines(
        join(packageData.dir, "var/lib/named"),
        zone.file,
        [...zone.records].map(r => r.toString(maxKeyLength, ttl))
      );
    }

    await writeLines(
      join(packageData.dir, "etc/named/zones"),
      config.name,
      content
    );
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
