import { join, dirname } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import {
  isLinkLocal,
  reverseArpa,
  FAMILY_IPV4,
  FAMILY_IPV6
} from "ip-utilties";
import {
  default_collection_attribute_writable,
  default_attribute_writable,
  duration_attribute_writable,
  string_set_attribute_writable,
  boolean_attribute_writable_true,
  boolean_attribute_writable_false,
  integer_attribute_writable,
  name_attribute_writable
} from "pacc";
import {
  Service,
  Base,
  ExtraSourceService,
  serviceEndpoints,
  addresses,
  networkAddressType,
  addType
} from "pmcf";
import { yesno, writeLines, asArray } from "../utils.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsRecordTypeForAddressFamily,
  sortZoneRecords
} from "../dns-utils.mjs";
import { addHook } from "../hooks.mjs";
import { owner_attribute } from "../common-attributes.mjs";

const bindNetworkAddressTypes = networkAddressType + "|bind_group";

class bind_group extends Base {
  static priority = 1;
  static attributes = {
    name: name_attribute_writable,
    owner: owner_attribute,
    access: {
      type: bindNetworkAddressTypes,
      name: "access",
      collection: true,
      writable: true
    },
    excludeInterfaceKinds: {
      ...string_set_attribute_writable,
      name: "excludeInterfaceKinds"
    },
    exclude: {
      ...default_collection_attribute_writable,
      name: "exclude",
      type: networkAddressType
    },
    entries: {
      ...default_collection_attribute_writable,
      type: networkAddressType + "|owner",
      name: "entries"
    },
    sharedWith: {
      ...default_attribute_writable,
      name: "sharedWith",
      type: bind_group
    },
    allowedUpdates: {
      type: bindNetworkAddressTypes,
      name: "allowedUpdates",
      collection: true,
      writable: true
    },
    notify: { ...boolean_attribute_writable_false, name: "notify" },
    hasCatalog: { ...boolean_attribute_writable_true, name: "hasCatalog" },
    hasReverse: { ...boolean_attribute_writable_false, name: "hasReverse" },
    hasSVRRecords: {
      ...boolean_attribute_writable_false,
      name: "hasSVRRecords"
    },
    hasLinkLocalAdresses: {
      ...boolean_attribute_writable_false,
      name: "hasLinkLocalAdresses"
    },
    hasLocationRecord: {
      ...boolean_attribute_writable_true,
      name: "hasLocationRecord"
    },
    recordTTL: {
      ...duration_attribute_writable,
      name: "recordTTL",
      default: "1W"
    },
    serial: {
      ...integer_attribute_writable,
      name: "serial",
      default: Math.ceil(Date.now() / 1000)
    },
    refresh: {
      ...duration_attribute_writable,
      name: "refresh",
      default: 36000
    },
    retry: { ...duration_attribute_writable, name: "retry", default: 72000 },
    expire: { ...duration_attribute_writable, name: "expire", default: 600000 },
    minimum: { ...duration_attribute_writable, name: "minimum", default: 60000 }
  };

  static {
    addType(this);
  }

  access = [];
  allowedUpdates = [];
  entries = [];
  exclude = new Set();
  excludeInterfaceKinds = new Set();
  notify = true;
  hasCatalog = true;
  hasSVRRecords = true;
  hasLinkLocalAdresses = bind_group.attributes.hasLinkLocalAdresses.default;

  recordTTL = "1W";

  get service() {
    return this.owner;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  get defaultRecords() {
    const nameService = this.owner; //ss[0];

    console.log(
      "nameService",
      nameService.fullName,
      nameService.domainName,
      nameService.address()
    );

    return [
      DNSRecord(
        "@",
        "SOA",
        dnsFullName(nameService.domainName),
        dnsFullName(this.administratorEmail.replace(/@/, ".")),
        `(${this.soaUpdates.join(" ")})`
      ),
      DNSRecord("@", "NS", dnsFullName(nameService.address()))
    ];
  }

  async packageContent(outputControl) {
    let hasContent = false;

    if (this.access.length) {
      hasContent ||= await this.generateACLs(outputControl);
    }

    if (this.entries.length) {
      hasContent ||= await this.generateZoneDefs(outputControl, this.entries);
    }

    return hasContent;
  }

  async generateACLs(outputControl) {
    const acls = addressesStatement(
      `acl ${this.name}`,
      addresses(this.access, { aggregate: true })
    );

    if (acls.length) {
      await writeLines(
        join(outputControl.dir, "etc/named"),
        `0-acl-${this.name}.conf`,
        acls
      );
    }

    return acls.length > 0;
  }

  async generateZoneDefs(outputControl, sources) {
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
          name: `${domain}.zone.conf`,
          type: this.service.serverType,
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

              for (const service of host.services.values()) {
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
      }
    }

    await this.writeZones(outputControl);

    return outputControl.packageData;
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
        name: `catalog.${name}.zone.conf`,
        type: this.service.serverType,
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

  async writeZones(outputControl) {
    for (const config of outputControl.configs) {
      console.log(`config: ${this.name}/${config.name}`);

      const content = [];

      for (const zone of config.zones) {
        console.log(`  file: ${zone.file}`);

        content.push(`zone \"${zone.id}\" {`);

        if (this.sharedWith) {
          content.push(`  in-view ${this.sharedWith.name};`);
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
        join(outputControl.dir, `etc/named/${this.name}`),
        config.name,
        content
      );
    }
  }
}

function addressesStatement(prefix, objects, generateEmpty = false) {
  const body = asArray(objects).map(name => `  ${name};`);

  if (body.length || generateEmpty) {
    return [`${prefix} {`, body, "};"];
  }

  return [];
}

export class bind extends ExtraSourceService {
  static specializationOf = Service;
  static attributes = {
    groups: {
      ...default_collection_attribute_writable,
      name: "groups",
      type: bind_group,
      backpointer: owner_attribute
    },
    primaries: {
      ...default_collection_attribute_writable,
      name: "primaries",
      type: networkAddressType,
    }
  };
  static service = {
    systemdService: "bind.service",
    extends: ["dns"],
    services: {
      "bind-statistics": {
        endpoints: [
          {
            family: FAMILY_IPV4,
            port: 19521,
            protocol: "tcp",
            pathname: "/",
            tls: false,
            kind: "loopback"
          },
          {
            family: FAMILY_IPV6,
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
            family: FAMILY_IPV4,
            port: 953,
            protocol: "tcp",
            tls: false,
            kind: "loopback"
          }
        ]
      }
    }
  };

  static {
    addType(this);
  }

  groups = new Map();

  materializeExtends() {
    super.materializeExtends();

    for (const service of this.walkDirections(["extends"])) {
      for (const group of service.groups.values()) {
        const present = this.groups.get(group.name);

        if (present) {
          present.extends.add(group);
        } else {
          this.groups.set(group.name, group.forOwner(this));
        }
      }
    }
  }

  get serverType() {
    return this.primaries ? "secondary" : "primary";
  }

  async writeForwarders(outputControl) {
    const forwarders = serviceEndpoints(this.source, {
      services: 'services[types[dns]" && priority>=100 && priority<200]',
      endpoints: endpoint => endpoint.family !== "dns",
      select: e => e.address,
      limit: 5
    });

    if (forwarders.length) {
      await writeLines(
        join(outputControl.dir, "etc/named/options"),
        `forwarders.conf`,
        addressesStatement("forwarders", forwarders)
      );
    }

    return forwarders.length > 0;
  }

  async *preparePackages(dir) {
    const basePackageDir = dir;
    const packageData = this.packageData;
    packageData.sources.push(new FileContentProvider(basePackageDir));

    const outputControl = newOutputControl(packageData, basePackageDir);

    let hasContent = false;

    console.log("PAKAGE", Object.keys(this.groups));

    for (const group of Object.values(this.groups)) {
      hasContent ||= await group.packageContent(outputControl);
    }

    hasContent ||= await this.writeForwarders(outputControl);

    if (hasContent) {
      yield packageData;
    }

    /*
    const sources = this.zones.length ? this.zones : [this.owner];
    const names = sources.map(a => a.fullName).join(" ");
    const name = this.owner.owner.name || this.owner.name;

    Object.assign(packageData.properties, {
      name: `named-${name}`,
      description: `named definitions for ${names}`
    });

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

    yield this.generateZoneDefs(
      newOutputControl(packageData, zonesPackageDir),
      sources
    );

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

    yield* this.generateOutfacingDefs(
      newOutputControl(packageData, outfacingZonesPackageDir),
      sources
    );
    */
  }

  async *generateOutfacingDefs(outputControl, sources) {
    for (const source of sources) {
      for (const host of source.hosts.values()) {
        this.outfacingZones(
          outputControl,
          host,
          this.groups.get("internal"),
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

  outfacingZones(outputControl, host, group, records) {
    host.foreignDomainNames.map(domain => {
      const wildcard = domain.startsWith("*.");
      if (wildcard) {
        domain = domain.substring(2);
      }

      const zone = {
        id: domain,
        file: `${host.owner.name}/outfacing/${domain}.zone`,
        records: new Set(records)
      };
      const config = {
        group,
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

      this.assignCatalog(outputControl, zone, `outfacting.${host.owner.name}`);
    });
  }
}

function newOutputControl(packageData, dir) {
  return { configs: [], catalogs: new Map(), packageData, dir };
}
