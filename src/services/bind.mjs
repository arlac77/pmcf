import { join, dirname } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import { isLinkLocal, reverseArpa } from "ip-utilties";
import {
  addType,
  default_attribute_writable,
  string_attribute_writable,
  boolean_attribute_writable_true,
  boolean_attribute_writable_false,
  number_attribute_writable,
  string_collection_attribute_writable,
  name_attribute_writable
} from "pacc";
import {
  ExtraSourceService,
  serviceEndpoints,
  addresses,
  networkAddressType,
  addServiceType
} from "pmcf";
import { yesno, writeLines, asArray } from "../utils.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsRecordTypeForAddressFamily,
  sortZoneRecords
} from "../dns-utils.mjs";
import { ServiceTypeDefinition } from "../service.mjs";
import { ExtraSourceServiceTypeDefinition } from "../extra-source-service.mjs";
import { addHook } from "../hooks.mjs";

const BindServiceViewTypeDefinition = {
  name: "bind-view",
  key: "name",
  attributes: {
    name: { ...name_attribute_writable },
    access: {
      type: networkAddressType,
      collection: true,
      writable: true
    }
  }
};

const BindServiceTypeDefinition = {
  name: "bind",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    /*views: {
      type: "object", //BindServiceViewTypeDefinition,
      collection: true,
      writable: true
    },*/
    zones: {
      type: networkAddressType + "|location|owner",
      collection: true,
      writable: true
    },
    trusted: {
      type: networkAddressType,
      collection: true,
      writable: true
    },
    protected: {
      ...default_attribute_writable,
      type: networkAddressType,
      collection: true
    },
    internal: {
      ...default_attribute_writable,
      type: networkAddressType,
      collection: true
    },
    hasSVRRecords: boolean_attribute_writable_false,
    hasCatalog: boolean_attribute_writable_true,
    hasLinkLocalAdresses: boolean_attribute_writable_false,
    hasLocationRecord: boolean_attribute_writable_true,
    excludeInterfaceKinds: string_collection_attribute_writable,
    exclude: {
      ...default_attribute_writable,
      type: networkAddressType,
      collection: true
    },
    notify: boolean_attribute_writable_false,
    recordTTL: { ...string_attribute_writable, default: "1W" },
    serial: number_attribute_writable,
    refresh: { ...string_attribute_writable, default: 36000 },
    retry: { ...string_attribute_writable, default: 72000 },
    expire: { ...string_attribute_writable, default: 600000 },
    minimum: { ...string_attribute_writable, default: 60000 },
    allowedUpdates: string_collection_attribute_writable,
    primaries: {
      ...default_attribute_writable,
      type: networkAddressType,
      collection: true
    }
  },
  service: {
    systemdService: "bind.service",
    extends: ["dns"],
    services: {
      "bind-statistics": {
        endpoints: [
          {
            family: "IPv4",
            port: 19521,
            protocol: "tcp",
            pathname: "/",
            tls: false,
            kind: "loopback"
          },
          {
            family: "IPv6",
            port: 19521,
            protocol: "tcp",
            pathname: "/",
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
    BindServiceTypeDefinition.attributes.hasLinkLocalAdresses.default;
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
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return BindServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);

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

  get serverType()
  {
    return this.primaries ? "secondary" : "primary";
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
      outputs: this.outputs,
      sources: [new FileContentProvider(configPackageDir)],
      properties: {
        name: `named-${name}`,
        description: `named definitions for ${names}`,
        access: "private"
      }
    };

    const forwarders = serviceEndpoints(this.source, {
      services: 'type="dns" && priority>=100 && priority<200',
      endpoints: endpoint => endpoint.family !== "dns",
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

    const ownerAndGroup = { owner: "named", group: "named" };
    const filePermissions = [
      { ...ownerAndGroup, mode: 0o644 },
      { ...ownerAndGroup, mode: 0o755 }
    ];

    const zonesPackageDir = join(dir, "zones") + "/";

    packageData.sources = [
      new FileContentProvider(zonesPackageDir, ...filePermissions)
    ];
    packageData.properties = {
      name: `named-zones-${name}`,
      description: `zone definitions for ${names}`,
      dependencies: ["mf-named"],
      access: "private"
    };

    yield this.generateZoneDefs(newOutputControl(packageData, zonesPackageDir), sources);

    const location = "outfacing";

    const outfacingZonesPackageDir = join(dir, location) + "/";

    packageData.sources = [
      new FileContentProvider(outfacingZonesPackageDir, ...filePermissions)
    ];
    packageData.properties = {
      name: `named-zones-${name}-${location}`,
      description: `${location} zone definitions for ${names}`,
      access: "private"
    };

    yield* this.generateOutfacingDefs(newOutputControl(packageData, outfacingZonesPackageDir), sources);
  }

  async *generateOutfacingDefs(outputControl, sources) {
    for (const source of sources) {
      for (const host of source.hosts()) {
        this.outfacingZones(
          outputControl,
          host,
          this.views.internal,
          this.defaultRecords
        );
      }
    }

    if (outputControl.configs.length) {
      addHook(
        outputControl.packageData,
        "post_upgrade",
        `/usr/bin/named-hostname-update ${outputControl.configs
          .map(config => config.zones.map(zone => zone.id))
          .flat()
          .join(" ")}`
      );

      await this.writeZones(outputControl);

      yield outputControl.packageData;
    }
  }

  async generateZoneDefs(outputControl, sources) {
    const view = this.views.internal;

    for (const source of sources) {
      console.log(
        "ZONE",
        source.toString(),
        [...source.localDomains].join(" ")
      );

      for (const domain of source.localDomains) {
        const locationName = source.location.name;
        const reverseZones = new Map();

        const config = {
          view,
          name: `${domain}.zone.conf`,
          type: this.serverType,
          zones: []
        };
        outputControl.configs.push(config);

        const zone = {
          id: domain,
          config,
          file: `${locationName}/${domain}.zone`,
          records: new Set(this.defaultRecords)
        };

        if (this.hasLocationRecord) {
          zone.records.add(DNSRecord("location", "TXT", locationName));
        }

        config.zones.push(zone);

        this.assignCatalog(outputControl, zone, domain);

        const hosts = new Set();
        const addresses = new Set();

        for (const {
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
                  config,
                  file: `${locationName}/${id}.zone`,
                  records: new Set(this.defaultRecords)
                };
                config.zones.push(reverseZone);
                reverseZones.set(subnet, reverseZone);

                this.assignCatalog(outputControl, reverseZone, domain);
              }

              for (const domainName of domainNames) {
                if (domainName.endsWith(zone.id) && domainName[0] !== "*") {
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

              for (const service of host.services) {
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
        outputControl.configs.push({
          view: this.views.protected,
          inView: this.views.protected.inView,
          name: config.name,
          zones: config.zones
        });
      }
    }

    await this.writeZones(outputControl);

    return outputControl.packageData;
  }

  outfacingZones(outputControl, host, view, records) {
    host.foreignDomainNames.map(domain => {
      const wildcard = domain.startsWith("*.");
      if (wildcard) {
        domain = domain.substring(2);
      }

      const zone = {
        id: domain,
        file: `${host.location.name}/outfacing/${domain}.zone`,
        records: new Set(records)
      };
      const config = {
        view,
        name: `${domain}.zone.conf`,
        type: this.serverType,
        zones: [zone]
      };
      zone.config = config;
      outputControl.configs.push(config);

      if (this.hasLocationRecord) {
        zone.records.add(DNSRecord("location", "TXT", host.location.name));
      }
      for (const na of host.networkAddresses(
        na => na.networkInterface.kind !== "loopback"
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

      this.assignCatalog(
        outputControl,
        zone,
        `outfacting.${host.location.name}`
      );
    });
  }

  assignCatalog(outputControl, zone, name) {
    if (!this.hasCatalog) {
      return;
    }

    const directory = dirname(zone.file);

    let catalogZone = outputControl.catalogs.get(directory);

    if (!catalogZone) {
      catalogZone = {
        catalog: true,
        id: `catalog.${name}`,
        file: `${directory}/catalog.${name}.zone`,
        records: new Set([
          ...this.defaultRecords,
          DNSRecord("version", "TXT", '"2"')
        ])
      };
      outputControl.catalogs.set(directory, catalogZone);
      const config = {
        view: zone.config.view,
        name: `catalog.${name}.zone.conf`,
        type: this.serverType,
        zones: [catalogZone]
      };
      catalogZone.config = config;
      outputControl.configs.push(config);
    }
    zone.catalogZone = catalogZone;

    const hash = createHmac("sha1", zone.id).digest("hex");
    catalogZone.records.add(
      DNSRecord(`${hash}.zones`, "PTR", dnsFullName(zone.id))
    );

    return catalogZone;
  }

  get defaultRecords() {
    const nameService = this.findService('in("dns",types) && priority>=300');

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

  async writeZones(outputControl) {
    for (const config of outputControl.configs) {
      console.log(`config: ${config.view.name}/${config.name}`);

      const content = [];

      for (const zone of config.zones) {
        console.log(`  file: ${zone.file}`);

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
          content.push(`  notify ${yesno(this.notify)};`);
        }
        content.push(`};`, "");

        let maxKeyLength = 0;
        for (const r of zone.records) {
          if (r.key.length > maxKeyLength) {
            maxKeyLength = r.key.length;
          }
        }

        await writeLines(
          join(outputControl.dir, "var/lib/named"),
          zone.file,
          [...zone.records]
            .sort(sortZoneRecords)
            .map(r => r.toString(maxKeyLength, this.recordTTL))
        );
      }

      await writeLines(
        join(outputControl.dir, `etc/named/${config.view.name}`),
        config.name,
        content
      );
    }
  }
}

function newOutputControl(packageData, dir) {
  return { configs: [], catalogs: new Map(), packageData, dir };
}
