import { join } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import { isLinkLocal, reverseArpa } from "ip-utilties";
import {
  string_attribute_writable,
  boolean_attribute_writable_true,
  boolean_attribute_writable_false,
  number_attribute,
  string_collection_attribute_writable
} from "pacc";
import { writeLines, asArray } from "../utils.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsRecordTypeForAddressFamily,
  sortZoneRecords
} from "../dns-utils.mjs";
import {
  ExtraSourceService,
  serviceEndpoints,
  addresses,
  networkAddressType
} from "pmcf";
import { addType } from "../types.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";
import { ExtraSourceServiceTypeDefinition } from "../extra-source-service.mjs";
import { addHook } from "../hooks.mjs";

const BindServiceTypeDefinition = {
  name: "bind",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  properties: {
    zones: {
      type: [...networkAddressType, "location", "owner"],
      collection: true,
      writable: true
    },
    trusted: {
      type: networkAddressType,
      collection: true,
      writable: true
    },
    protected: { type: networkAddressType, collection: true, writable: true },
    internal: { type: networkAddressType, collection: true, writable: true },
    hasSVRRecords: boolean_attribute_writable_false,
    hasCatalog: boolean_attribute_writable_true,
    hasLinkLocalAdresses: boolean_attribute_writable_false,
    hasLocationRecord: boolean_attribute_writable_true,
    excludeInterfaceKinds: {
      ...string_collection_attribute_writable
    },
    exclude: { type: networkAddressType, collection: true, writable: true },
    notify: boolean_attribute_writable_false,
    recordTTL: { ...string_attribute_writable },
    serial: { ...number_attribute, writable: true },
    refresh: { ...string_attribute_writable, default: 36000 },
    retry: { ...string_attribute_writable, default: 72000 },
    expire: { ...string_attribute_writable, default: 600000 },
    minimum: { ...string_attribute_writable, default: 60000 },
    allowedUpdates: { ...string_collection_attribute_writable }
  },

  service: {
    extends: ["dns"],
    services: {
      "bind-statistics": {
        endpoints: [
          {
            family: "IPv4",
            port: 19521,
            protocol: "tcp",
            tls: false,
            kind: "loopback"
          }
        ]
      },
      "bind-rdnc": {
        endpoints: [
          {
            family: "IPv4",
            port: 953,
            protocol: "tcp",
            tls: false,
            kind: "loopback"
          }
        ]
      }
    }
  }
};

function addressesStatement(prefix, objects, generateEmpty = false) {
  const body = asArray(objects).map(name => `  ${name};`);

  if (body.length || generateEmpty) {
    return [`${prefix} {`, body, "};"];
  }

  return [];
}

export class BindService extends ExtraSourceService {
  allowedUpdates = [];
  recordTTL = "1W";
  hasSVRRecords = true;
  hasCatalog = true;
  hasLinkLocalAdresses =
    BindServiceTypeDefinition.properties.hasLinkLocalAdresses.default;
  hasLocationRecord = true;
  notify = true;
  _zones = [];
  _trusted = [];
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
    return BindServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);

    this._systemd = "bind.service";

    // TODO
    const dns = new Service(owner);
    dns.name = "dns";
    dns.type = "dns";

    this._extends.push(dns);
    this.views = {};

    for (const name of ["internal", "protected"]) {
      this.views[name] = {
        name,
        access: []
      };
    }

    this.views.protected.inView = this.views.internal;
    this.views.protected.access = ["!internal"];
  }

  get type() {
    return BindServiceTypeDefinition.name;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  set zones(value) {
    this._zones.push(value);
  }

  get zones() {
    return this._zones;
  }

  set protected(value) {
    this.views.protected.access.push(value);
  }

  get protected() {
    return this.views.protected.access;
  }

  set internal(value) {
    this.views.internal.access.push(value);
  }

  get internal() {
    return this.views.internal.access;
  }

  set trusted(value) {
    this._trusted.push(value);
  }

  get trusted() {
    return this._trusted;
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
    const sources = this.zones.length ? this.zones : [this.owner];
    const names = sources.map(a => a.fullName).join(" ");
    const name = this.owner.owner.name || this.owner.name;

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
      services: { types: "dns", priority: ">=300" },
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

    const acls = addressesStatement(
      "acl trusted",
      addresses(this.trusted, { aggregate: true })
    );

    for (const view of Object.values(this.views)) {
      acls.push(
        ...addressesStatement(
          `acl ${view.name}`,
          addresses(view.access, { aggregate: true }),
          true
        )
      );
    }

    if (this.internal?.length) {
      await writeLines(
        join(configPackageDir, "etc/named"),
        `0-acl-${name}.conf`,
        acls
      );
    }
    if (forwarders.length || this.internal?.length) {
      yield packageData;
    }

    const zonesPackageDir = join(dir, "zones") + "/";

    packageData.dir = zonesPackageDir;
    packageData.properties = {
      name: `named-zones-${name}`,
      description: `zone definitions for ${names}`,
      dependencies: ["mf-named"],
      access: "private",
      hooks: {}
    };

    const filePermissions = [
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
    ];

    packageData.sources = [
      new FileContentProvider(zonesPackageDir, ...filePermissions)
    ];

    yield this.generateZoneDefs(sources, packageData);

    const outfacingZonesPackageDir = join(dir, "outfacingZones") + "/";

    packageData.dir = outfacingZonesPackageDir;
    packageData.properties = {
      name: `named-zones-${name}-outfacing`,
      description: `outfacing zone definitions for ${names}`,
      access: "private",
      replaces: [`named-zones-${name}-OUTFACING`],
      hooks: {}
    };

    packageData.sources = [
      new FileContentProvider(outfacingZonesPackageDir, ...filePermissions)
    ];

    yield* this.generateOutfacingDefs(sources, packageData);
  }

  async *generateOutfacingDefs(sources, packageData) {
    const configs = [];

    for (const source of sources) {
      for (const host of source.hosts()) {
        configs.push(
          ...this.outfacingZones(host, this.views.internal, this.defaultRecords)
        );
      }
    }

    const outfacingZones = configs.map(c => c.zones).flat();

    if (outfacingZones.length) {
      addHook(
        packageData.properties.hooks,
        "post_upgrade",
        `/usr/bin/named-hostname-info ${outfacingZones
          .map(zone => zone.id)
          .join(" ")}|/usr/bin/named-hostname-update`
      );

      await this.writeZones(packageData, configs);

      yield packageData;
    }
  }

  async generateZoneDefs(sources, packageData) {
    const configs = [];

    for (const source of sources) {
      console.log(
        "SOURCE",
        source.toString(),
        [...source.localDomains].join(" ")
      );

      for (const domain of source.localDomains) {
        const locationName = source.location.name;
        const reverseZones = new Map();

        const config = {
          view: this.views.internal,
          name: `${domain}.zone.conf`,
          type: "master",
          zones: []
        };
        configs.push(config);

        const zone = {
          id: domain,
          file: `${locationName}/${domain}.zone`,
          records: new Set(this.defaultRecords)
        };

        if (this.hasLocationRecord) {
          zone.records.add(DNSRecord("location", "TXT", locationName));
        }

        config.zones.push(zone);

        if (this.hasCatalog) {
          const catalogConfig = {
            view: this.views.internal,
            name: `catalog.${domain}.zone.conf`,
            type: "master",
            zones: []
          };
          configs.push(catalogConfig);

          zone.catalogZone = {
            catalog: true,
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

        console.log([...source.hosts()].map(h=>h.name));
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
            if (
              !addresses.has(address) &&
              (this.hasLinkLocalAdresses || !isLinkLocal(address))
            ) {
              addresses.add(address);

              let reverseZone = reverseZones.get(subnet);

              // is there already a matching subnet ?
              if (!reverseZone) {
                for (const [presentSubnet, zone] of reverseZones) {
                  if (presentSubnet.matchesAddress(subnet.address)) {
                    reverseZone = zone;
                  }
                }
              }

              if (!reverseZone) {
                const id = reverseArpa(subnet.prefix);
                reverseZone = {
                  id,
                  type: "plain",
                  file: `${locationName}/${id}.zone`,
                  records: new Set(this.defaultRecords)
                };
                config.zones.push(reverseZone);
                reverseZones.set(subnet, reverseZone);
              }

              for (const domainName of domainNames) {
                zone.records.add(
                  DNSRecord(
                    dnsFullName(domainName),
                    dnsRecordTypeForAddressFamily(family),
                    address
                  )
                );

                reverseZone.records.add(
                  DNSRecord(
                    dnsFullName(reverseArpa(address)),
                    "PTR",
                    dnsFullName(domainName)
                  )
                );
              }
            }

            const host = networkInterface.host;
            if (host && !hosts.has(host)) {
              hosts.add(host);

              for (const foreignDomainName of host.foreignDomainNames) {
                zone.records.add(
                  DNSRecord("outfacing", "PTR", dnsFullName(foreignDomainName))
                );
              }

              const sm = new Map();

              for (const service of host._services) {
                for (const record of service.dnsRecordsForDomainName(
                  host.domainName,
                  this.hasSVRRecords
                )) {
                  sm.set(record.toString(), record);
                }
              }

              for (const r of sm.values()) {
                zone.records.add(r);
              }
            }
          }
        }
        configs.push({
          view: this.views.protected,
          inView: this.views.protected.inView,
          name: config.name,
          zones: config.zones
        });
      }
    }

    await this.writeZones(packageData, configs);

    return packageData;
  }

  outfacingZones(host, view, records) {
    return host.foreignDomainNames.map(domain => {
      const wildcard = domain.startsWith("*.");
      if (wildcard) {
        domain = domain.substring(2);
      }

      const zone = {
        id: domain,
        file: `outfacing/${domain}.zone`,
        records: new Set(records)
      };
      const config = {
        view,
        name: `${domain}.zone.conf`,
        type: "master",
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

        if (wildcard) {
          zone.records.add(
            DNSRecord("*", dnsRecordTypeForAddressFamily(na.family), na.address)
          );
        }
      }

      return config;
    });
  }

  get defaultRecords() {
    const nameService = this.findService({ types: "dns", priority: ">=300" });

    const SOARecord = DNSRecord(
      "@",
      "SOA",
      dnsFullName(nameService.domainName),
      dnsFullName(this.administratorEmail.replace(/@/, ".")),
      `(${[...this.soaUpdates].join(" ")})`
    );

    const NSRecord = DNSRecord("@", "NS", dnsFullName(nameService.address()));

    return [SOARecord, NSRecord];
  }

  async writeZones(packageData, configs) {
    for (const config of configs) {
      console.log(`config: ${config.view.name}/${config.name}`);

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

        if (config.inView) {
          content.push(`  in-view ${config.inView.name};`);
        } else {
          content.push(`  type ${config.type};`);
          content.push(`  file \"${zone.file}\";`);
          content.push(
            `  allow-update { ${
              this.allowedUpdates.length
                ? this.allowedUpdates.join(";")
                : "none"
            }; };`
          );
          content.push(`  notify ${this.notify ? "yes" : "no"};`);
        }
        content.push(`};`, "");

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
        join(packageData.dir, `etc/named/${config.view.name}`),
        config.name,
        content
      );
    }
  }
}
