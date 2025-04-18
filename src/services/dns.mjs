import { join } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import { isLinkLocal, reverseArpa } from "ip-utilties";
import { writeLines, asArray } from "../utils.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsRecordTypeForAddressFamily,
  sortZoneRecords
} from "../dns-utils.mjs";
import {
  ExtraSourceService,
  Endpoint,
  serviceEndpoints,
  addresses
} from "pmcf";
import { addType } from "../types.mjs";
import { ServiceTypeDefinition } from "../service.mjs";
import { ExtraSourceServiceTypeDefinition } from "../extra-source-service.mjs";
import { addHook } from "../hooks.mjs";

const address_types = ["network", "host", "network_interface"];

const DNSServiceTypeDefinition = {
  name: "dns",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  properties: {
    trusted: {
      type: address_types,
      collection: true,
      writeable: true
    },
    protected: { type: address_types, collection: true, writeable: true },
    open: { type: address_types, collection: true, writeable: true },
    hasSVRRecords: {
      type: "boolean",
      collection: false,
      writeable: true,
      default: false
    },
    hasCatalog: {
      type: "boolean",
      collection: false,
      writeable: true,
      default: false
    },
    hasLinkLocalAdresses: {
      type: "boolean",
      collection: false,
      writeable: true,
      default: false
    },
    excludeInterfaceKinds: {
      type: "string",
      collection: true,
      writeable: true
    },

    exclude: { type: address_types, collection: true, writeable: true },
    notify: {
      type: "boolean",
      collection: false,
      writeable: true,
      default: false
    },
    recordTTL: { type: "string", collection: false, writeable: true },
    serial: { type: "number", collection: false, writeable: true },
    refresh: { type: "string", collection: false, writeable: true },
    retry: { type: "string", collection: false, writeable: true },
    expire: { type: "string", collection: false, writeable: true },
    minimum: { type: "string", collection: false, writeable: true },
    allowedUpdates: { type: "string", collection: true, writeable: true }
  }
};

const rdncEndpoint = {
  type: "rdnc",
  port: 953,
  protocol: "tcp",
  tls: false
};

const statisticsEndpoint = {
  type: "bind-statistics",
  port: 19521,
  protocol: "tcp",
  tls: false
};

function addressesStatement(prefix, objects, generateEmpty = false) {
  const body = asArray(objects).map(name => `  ${name};`);

  if (body.length || generateEmpty) {
    return [`${prefix} {`, body, "};"];
  }

  return [];
}

export class DNSService extends ExtraSourceService {
  allowedUpdates = [];
  recordTTL = "1W";
  hasSVRRecords = true;
  hasCatalog = true;
  hasLinkLocalAdresses = true;
  notify = true;
  _trusted = [];
  _protected = [];
  _open = [];
  _exclude = new Set([]);
  _excludeInterfaceKinds = new Set();

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

  endpoints(filter) {
    const endpoints = super.endpoints(filter);

    for (const na of this.owner.networkAddresses(
      na => na.networkInterface.kind === "localhost"
    )) {
      endpoints.push(new Endpoint(this, na, rdncEndpoint));
      endpoints.push(new Endpoint(this, na, statisticsEndpoint));
    }

    return endpoints;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  set protected(value) {
    this._protected.push(value);
  }

  get protected() {
    return this._protected;
  }

  set trusted(value) {
    this._trusted.push(value);
  }

  get trusted() {
    return this._trusted;
  }

  set open(value) {
    this._open.push(value);
  }

  get open() {
    return this._open;
  }

  set exclude(value) {
    this._exclude.add(value);
  }

  get exclude() {
    return this._exclude;
  }

  set excludeInterfaceKinds(value) {
    this._excludeInterfaceKinds.add(value);
  }

  get excludeInterfaceKinds() {
    return this._excludeInterfaceKinds;
  }

  async *preparePackages(dir) {
    const location = this.owner.owner;
    const name = location.name;
    const p1 = join(dir, "p1") + "/";
    const packageData = {
      dir: p1,
      sources: [new FileContentProvider(p1)],
      outputs: this.outputs,
      properties: {
        name: `named-${name}`,
        description: `named definitions for ${location.fullName}`,
        access: "private"
      }
    };

    const forwarders = serviceEndpoints(this.source, {
      services: { type: "dns", priority: ">=20" },
      select: e => e.address,
      limit: 5
    });

    if (forwarders.length) {
      await writeLines(
        join(p1, "etc/named/options"),
        `forwarders.conf`,
        addressesStatement("forwarders", forwarders)
      );
    }

    const acls = [
      addressesStatement(
        "acl trusted",
        addresses(this.trusted, { aggregate: true })
      ),
      addressesStatement(
        "acl open",
        addresses(this.open, { aggregate: true }),
        true
      ),
      addressesStatement("acl protected", [
        ...addresses(this.protected, { aggregate: true }),
        "!open"
      ])
    ].flat();

    if (acls.length) {
      await writeLines(join(p1, "etc/named"), `0-acl-${name}.conf`, acls);
    }
    if (forwarders.length || acls.length) {
      yield packageData;
    }

    const p2 = join(dir, "p2") + "/";

    packageData.dir = p2;
    packageData.properties = {
      name: `named-zones-${name}`,
      description: `zone definitions for ${location.fullName}`,
      dependencies: ["mf-named"],
      replaces: ["mf-named-zones"],
      access: "private",
      hooks: {}
    };

    packageData.sources = [
      new FileContentProvider(
        p2,
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
      )
    ];

    await generateZoneDefs(this, location, packageData);

    yield packageData;
  }
}

async function generateZoneDefs(dns, location, packageData) {
  const ttl = dns.recordTTL;
  const nameService = dns.findService({ type: "dns", priority: "<10" });
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

      zone.records.add(DNSRecord("location", "TXT", host.location.name));

      for (const na of host.networkAddresses(
        na => na.networkInterface.kind != "loopback"
      )) {
        zone.records.add(
          DNSRecord("@", dnsRecordTypeForAddressFamily(na.family), na.address)
        );
      }
    }
  }

  const foreignZones = configs.map(c => c.zones).flat();

  if (foreignZones.length) {
    addHook(
      packageData.properties.hooks,
      "post_upgrade",
      //  `rm -f ${foreignZones.map(zone => `/var/lib/named/${zone.file}.jnl`)}\n` +
      //    "systemctl try-reload-or-restart named\n" +
      `/usr/bin/named-hostname-info ${foreignZones
        .map(zone => zone.id)
        .join(" ")}|/usr/bin/named-hostname-update`
    );
  }

  console.log(
    "LOCAL DOMAINS",
    location.localDomains,
    location.domain,
    location.toString()
  );

  for (const domain of location.localDomains) {
    const locationName = location.name;
    const reverseZones = new Map();

    const config = {
      name: `${domain}.zone.conf`,
      zones: []
    };
    configs.push(config);

    const locationRecord = DNSRecord("location", "TXT", locationName);

    const zone = {
      id: domain,
      file: `${locationName}/${domain}.zone`,
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
        file: `${locationName}/catalog.${domain}.zone`,
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
      domainNames,
      family
    } of location.networkAddresses()) {
      if (
        !dns.exclude.has(networkInterface.network) &&
        !dns.excludeInterfaceKinds.has(networkInterface.kind)
      ) {
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
                dnsRecordTypeForAddressFamily(family),
                address
              )
            );
          }
          if (subnet && host.domain === domain) {
            let reverseZone = reverseZones.get(subnet.address);

            if (!reverseZone) {
              const id = reverseArpa(subnet.prefix);
              reverseZone = {
                id,
                type: "plain",
                file: `${locationName}/${id}.zone`,
                records: new Set([SOARecord, NSRecord])
              };
              config.zones.push(reverseZone);
              reverseZones.set(subnet.address, reverseZone);
            }

            for (const domainName of host.domainNames) {
              reverseZone.records.add(
                DNSRecord(
                  dnsFullName(reverseArpa(address)),
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
              DNSRecord("outfacing", "PTR", dnsFullName(foreignDomainName))
            );
          }

          for (const service of host.findServices()) {
            for (const record of service.dnsRecordsForDomainName(
              host.domainName,
              dns.hasSVRRecords
            )) {
              zone.records.add(record);
            }
          }
        }
      }
    }
  }

  for (const config of configs) {
    console.log(`config: ${config.name}`);

    const content = [];
    for (const zone of config.zones) {
      console.log(`  file: ${zone.file}`);

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
        [...zone.records]
          .sort(sortZoneRecords)
          .map(r => r.toString(maxKeyLength, ttl))
      );
    }

    await writeLines(
      join(packageData.dir, "etc/named/zones"),
      config.name,
      content
    );
  }
}
