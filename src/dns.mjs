import { join } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import { writeLines, isIPv6Address, normalizeIPAddress } from "./utils.mjs";
import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

const DNSServiceTypeDefinition = {
  name: "dns",
  owners: ["location", "owner", "network", "cluster", "root"],
  priority: 0.1,
  properties: {
    hasSVRRecords: { type: "boolean", collection: false, writeable: true },
    hasCatalog: { type: "boolean", collection: false, writeable: true },
    notify: { type: "boolean", collection: false, writeable: true },
    recordTTL: { type: "string", collection: false, writeable: true },
    refresh: { type: "string", collection: false, writeable: true },
    retry: { type: "string", collection: false, writeable: true },
    expire: { type: "string", collection: false, writeable: true },
    minimum: { type: "string", collection: false, writeable: true },
    forwardsTo: { type: "network", collection: true, writeable: true },
    allowedUpdates: { type: "string", collection: true, writeable: true }
  }
};

const DNS_SERVICE_FILTER = { type: DNSServiceTypeDefinition.name };

export class DNSService extends Base {
  allowedUpdates = [];
  recordTTL = "1W";
  hasSVRRecords = true;
  hasCatalog = true;
  notify = true;
  #forwardsTo = [];

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

  set forwardsTo(value) {
    this.#forwardsTo.push(value);
  }

  get forwardsTo() {
    return this.#forwardsTo;
  }

  *findServices(filter) {
    yield* this.owner.findServices(filter);

    for (const s of this.forwardsTo) {
      yield* s.findServices(filter);
    }
  }

  get domains() {
    return [this.owner.domain];
  }

  async resolvedConfig() {
    const dnsServices = Array.from(this.findServices(DNS_SERVICE_FILTER)).sort(
      (a, b) => a.priority - b.priority
    );

    const master = dnsServices
      .filter(s => s.priority < 10)
      .map(s => s.rawAddresses)
      .flat();
    const fallback = dnsServices
      .filter(s => s.priority >= 10)
      .map(s => s.rawAddresses)
      .flat();

    return {
      DNS: master.join(" "),
      FallbackDNS: fallback.join(" "),
      Domains: this.domains.join(" "),
      DNSSEC: "no",
      MulticastDNS: "yes",
      LLMNR: "no"
    };
  }

  async *preparePackages(stagingDir) {
    for await (const result of super.preparePackages(stagingDir)) {
      await generateNamedDefs(this, stagingDir);

      result.properties.name = `named-${this.owner.name}`;
      result.properties.dependencies = ["mf-named"];
      result.properties.replaces = ["mf-named-zones"];

      result.sources.push(
        new FileContentProvider(stagingDir + "/")[Symbol.asyncIterator]()
      );

      yield result;
    }
  }
}

function fullName(name) {
  return name.endsWith(".") ? name : name + ".";
}

async function generateNamedDefs(dns, targetDir) {
  const ttl = dns.recordTTL;
  const updates = [Math.ceil(Date.now() / 1000), ...dns.soaUpdates].join(" ");

  for (const domain of dns.domains) {
    const zones = [];
    const records = new Set();

    const nameService = dns.findService(DNS_SERVICE_FILTER);
    const rname = dns.administratorEmail.replace(/@/, ".");

    let maxKeyLength;

    const createRecord = (key, type, ...values) => {
      values = values.map(v =>
        typeof v === "number" ? String(v).padStart(3) : v
      );

      return {
        key,
        toString: () =>
          `${key.padEnd(maxKeyLength, " ")} ${ttl} IN ${type.padEnd(
            5,
            " "
          )} ${values.join(" ")}`
      };
    };

    for await (const mail of dns.owner.findServices({ type: "smtp" })) {
      records.add(
        createRecord("@", "MX", mail.priority, fullName(mail.owner.domainName))
      );
    }

    //console.log(dns.owner.fullName, domain, nameService.domainName, rname);
    const reverseZones = new Map();

    const SOARecord = createRecord(
      "@",
      "SOA",
      fullName(nameService.domainName),
      fullName(rname),
      `(${updates})`
    );

    const NSRecord = createRecord("@", "NS", fullName(nameService.rawAddress));

    const zone = {
      id: domain,
      type: "plain",
      file: `${domain}.zone`,
      records: new Set([SOARecord, NSRecord, ...records])
    };
    zones.push(zone);

    const catalogZone = {
      id: `catalog.${domain}`,
      type: "catalog",
      file: `catalog.${domain}.zone`,
      records: new Set([
        SOARecord,
        NSRecord,
        createRecord(fullName(`version.catalog.${domain}`), "TXT", '"1"')
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

      if (!addresses.has(address)) {
        addresses.add(address);

        zone.records.add(
          createRecord(
            fullName(host.domainName),
            isIPv6Address(address) ? "AAAA" : "A",
            normalizeIPAddress(address)
          )
        );

        if (subnet) {
          let reverseZone = reverseZones.get(subnet.address);

          if (!reverseZone) {
            const reverseArpa = reverseArpaAddress(subnet.prefix);
            reverseZone = {
              id: reverseArpa,
              type: "plain",
              file: `${reverseArpa}.zone`,
              records: new Set([SOARecord, NSRecord])
            };
            zones.push(reverseZone);
            reverseZones.set(subnet.address, reverseZone);
          }
          reverseZone.records.add(
            createRecord(
              fullName(reverseArpaAddress(address)),
              "PTR",
              fullName(host.domainName)
            )
          );
        }
      }

      if (!hosts.has(host)) {
        hosts.add(host);
        for (const service of host.findServices()) {
          if (service.master && service.alias) {
            zone.records.add(
              createRecord(service.alias, "CNAME", fullName(host.domainName))
            );
          }

          if (dns.hasSVRRecords && service.srvPrefix) {
            zone.records.add(
              createRecord(
                fullName(`${service.srvPrefix}.${host.domainName}`),
                "SRV",
                service.priority,
                service.weight,
                service.port,
                fullName(host.domainName)
              )
            );
          }
        }
      }
    }

    for (const zone of zones) {
      const content = configs[zone.type].content;

      if (zone.type !== "catalog") {
        const hash = createHmac("md5", zone.id).digest("hex");
        catalogZone.records.add(
          createRecord(`${hash}.zones.${domain}.`, "PTR", fullName(zone.id))
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
        zone.records
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
