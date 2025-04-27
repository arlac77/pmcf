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

const BINDServiceTypeDefinition = {
  name: "dns",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  properties: {
    addresses: {
      type: ["network", "host", "network_interface", "location", "owner"],
      collection: true,
      writeable: true
    },

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
    hasLocationRecord: {
      type: "boolean",
      collection: false,
      writeable: true,
      default: true
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

export class BINDService extends ExtraSourceService {
  allowedUpdates = [];
  recordTTL = "1W";
  hasSVRRecords = true;
  hasCatalog = true;
  hasLinkLocalAdresses = true;
  hasLocationRecord = true;
  notify = true;
  _addresses = [];
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
    return BINDServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, BINDServiceTypeDefinition);
  }

  get type() {
    return BINDServiceTypeDefinition.name;
  }

  endpoints(filter) {
    const endpoints = super.endpoints(filter);

    for (const na of this.owner.networkAddresses(
      na => na.networkInterface.kind === "loopback"
    )) {
      endpoints.push(new Endpoint(this, na, rdncEndpoint));
      endpoints.push(new Endpoint(this, na, statisticsEndpoint));
    }

    return endpoints;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  set addresses(value) {
    this._addresses.push(value);
  }

  get addresses() {
    return this._addresses;
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
    const sources = this.addresses.length ? this.addresses : [this.owner];
    const names = sources.map(a => a.fullName).join(" ");

    const name = this.owner.owner.name;
    const configPackageDir = join(dir, "config") + "/";
    const packageData = {
      dir: configPackageDir,
      sources: [new FileContentProvider(configPackageDir)],
      outputs: this.outputs,
      properties: {
        name: `named-${name}`,
        description: `named definitions for ${names}`,
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
        join(configPackageDir, "etc/named/options"),
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
        "!open",
        ...addresses(this.protected, { aggregate: true })
      ])
    ].flat();

    if (acls.length) {
      await writeLines(join(configPackageDir, "etc/named"), `0-acl-${name}.conf`, acls);
    }
    if (forwarders.length || acls.length) {
      yield packageData;
    }

    const zonesPackageDir = join(dir, "zones") + "/";

    packageData.dir = zonesPackageDir;
    packageData.properties = {
      name: `named-zones-${name}`,
      description: `zone definitions for ${names}`,
      dependencies: ["mf-named"],
      replaces: ["mf-named-zones"],
      access: "private",
      hooks: {}
    };

    packageData.sources = [
      new FileContentProvider(
        zonesPackageDir,
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

    await this.generateZoneDefs(sources, packageData);

    const foreignZonesPackageDir = join(dir, "foreignZones") + "/";

    packageData.dir = foreignZonesPackageDir;
    packageData.properties = {
      name: `named-foreign-zones-${name}`,
      description: `foreign zone definitions for ${names}`,
      dependencies: [`named-zones-${name}`],
      access: "private",
      hooks: {}
    };

    packageData.sources = [
      new FileContentProvider(
        foreignZonesPackageDir,
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

    await this.generateForeignDefs(sources, packageData);

    yield packageData;
  }

  async generateForeignDefs(sources, packageData) {
    const configs = [];

    for (const source of sources) {
      for (const host of source.hosts()) {
        configs.push(...this.foreignDomainZones(host, this.defaultRecords));
      }
    }

    const foreignZones = configs.map(c => c.zones).flat();

    if (foreignZones.length) {
      addHook(
        packageData.properties.hooks,
        "post_upgrade",
        `/usr/bin/named-hostname-info ${foreignZones
          .map(zone => zone.id)
          .join(" ")}|/usr/bin/named-hostname-update`
      );
    }

    await this.writeZones(packageData, configs);
  }

  async generateZoneDefs(sources, packageData) {
    const configs = [];

    for (const source of sources) {
      console.log(
        "LOCAL DOMAINS",
        source.localDomains,
        source.domain,
        source.toString()
      );

      for (const domain of source.localDomains) {
        const locationName = source.name;
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
          records: new Set([...this.defaultRecords, locationRecord])
        };
        config.zones.push(zone);

        if (this.hasCatalog) {
          const catalogConfig = {
            name: `catalog.${domain}.zone.conf`,
            zones: []
          };
          configs.push(catalogConfig);

          zone.catalogZone = {
            id: `catalog.${domain}`,
            file: `${locationName}/catalog.${domain}.zone`,
            records: new Set([
              ...this.defaultRecords,
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
        } of source.networkAddresses()) {
          if (
            !this.exclude.has(networkInterface.network) &&
            !this.excludeInterfaceKinds.has(networkInterface.kind)
          ) {
            const host = networkInterface.host;
            if (host) {
              if (
                !addresses.has(address) &&
                (this.hasLinkLocalAdresses || !isLinkLocal(address))
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
                if (subnet && host?.domain === domain) {
                  let reverseZone = reverseZones.get(subnet.address);

                  if (!reverseZone) {
                    const id = reverseArpa(subnet.prefix);
                    reverseZone = {
                      id,
                      type: "plain",
                      file: `${locationName}/${id}.zone`,
                      records: new Set(this.defaultRecords)
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
                    DNSRecord(
                      "outfacing",
                      "PTR",
                      dnsFullName(foreignDomainName)
                    )
                  );
                }

                //   console.log(host._services.map(s=>s.name));
                for (const service of host._services) {
                  for (const record of service.dnsRecordsForDomainName(
                    host.domainName,
                    this.hasSVRRecords
                  )) {
                    //console.log("SERVICE",service.toString(),record.toString())

                    zone.records.add(record);
                  }
                }
              }
            }
          }
        }
      }
    }

    await this.writeZones(packageData, configs);
  }

  foreignDomainZones(host, records) {
    return host.foreignDomainNames.map(domain => {
      const zone = {
        id: domain,
        file: `FOREIGN/${domain}.zone`,
        records: new Set(records)
      };
      const config = {
        name: `${domain}.zone.conf`,
        zones: [zone]
      };

      if (this.hasLocationRecord) {
        zone.records.add(DNSRecord("location", "TXT", host.location.name));
      }
      for (const na of host.networkAddresses(
        na => na.networkInterface.kind != "loopback"
      )) {
        zone.records.add(
          DNSRecord("@", dnsRecordTypeForAddressFamily(na.family), na.address)
        );
      }

      return config;
    });
  }

  get defaultRecords() {
    const nameService = this.findService({ type: "dns", priority: "<10" });
    const rname = this.administratorEmail.replace(/@/, ".");

    const SOARecord = DNSRecord(
      "@",
      "SOA",
      dnsFullName(nameService.domainName),
      dnsFullName(rname),
      `(${[...this.soaUpdates].join(" ")})`
    );

    const NSRecord = DNSRecord(
      "@",
      "NS",
      dnsFullName(nameService.ipAddressOrDomainName)
    );

    return [SOARecord, NSRecord];
  }

  async writeZones(packageData, configs) {
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
            this.allowedUpdates.length ? this.allowedUpdates.join(";") : "none"
          }; };`
        );
        content.push(`  notify ${this.notify ? "yes" : "no"};`);
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
            .map(r => r.toString(maxKeyLength, this.recordTTL))
        );
      }

      await writeLines(
        join(packageData.dir, "etc/named/zones"),
        config.name,
        content
      );
    }
  }
}
