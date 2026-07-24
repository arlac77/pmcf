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
  default_collection_attribute,
  default_collection_attribute_writable,
  default_attribute_writable,
  duration_attribute_writable,
  name_attribute,
  string_attribute,
  string_set_attribute_writable,
  string_set_attribute,
  boolean_attribute_writable_true,
  boolean_attribute_writable_false,
  integer_attribute_writable,
  integer_attribute,
  name_attribute_writable
} from "pacc";
import {
  Base,
  ExtraSourceService,
  serviceEndpoints,
  addresses,
  networkAddressType,
  addType,
  FAMILY_DNS
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

class bind_zone extends Base {
  static priority = 1;
  static key = "id";
  static attributes = {
    id: { ...name_attribute, name: "id" },
    file: { ...string_attribute, name: "file" },
    records: { ...string_set_attribute, name: "records" }
  };

  static {
    addType(this);
  }

  get name() {
    return this.id;
  }

  get fullName() {
    return this.id;
  }

  get domain() {
    return this.id;
  }

  get directory() {
    return this.source.name;
  }

  get file() {
    return `${this.directory}/${this.domain}.zone`;
  }

  constructor(owner, id, config, source) {
    super();
    this.id = id;
    this.config = config;
    this.source = source;
    this.records = new Set(owner.defaultRecords);

    config.zones.push(this);
  }
}

class bind_zone_config extends Base {
  static priority = 1;
  static attributes = {
    zones: { ...default_collection_attribute, type: bind_zone, name: "zones" }
  };

  static {
    addType(this);
  }

  zones = [];

  get type() {
    return this.owner.service.serverType;
  }

  constructor(owner, name) {
    super();
    this.owner = owner;
    this.name = name;
  }
}

class bind_group extends Base {
  static priority = 1;
  static attributes = {
    name: name_attribute_writable,
    order: { ...integer_attribute, name: "order" },
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
    domains: {
      ...string_set_attribute,
      name: "domains"
    },
    zones: {
      ...default_collection_attribute,
      type: bind_zone,
      backpointer: owner_attribute,
      name: "zones"
    },
    zoneConfigs: {
      ...default_collection_attribute,
      type: bind_zone_config,
      backpointer: owner_attribute,
      name: "zoneConfigs"
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
  zoneConfigs = [];
  exclude = new Set();
  excludeInterfaceKinds = new Set();
  notify = true;
  hasCatalog = true;
  hasSVRRecords = true;
  hasLinkLocalAdresses = bind_group.attributes.hasLinkLocalAdresses.default;
  recordTTL = "1W";

  /**
   * Type of the group.
   * @return {string} view | unknown
   */
  get type() {
    if (this.entries.length > 0 || this.sharedWith) {
      return "view";
    }

    return "unknown";
  }

  get order() {
    return this.sharedWith ? this.sharedWith.order + 1 : 0;
  }

  get service() {
    return this.owner;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  get defaultRecords() {
    const service = this.service;

    /*console.log(
      "nameService",
      service.fullName,
      service.domainName,
      service.address()
    );*/

    return [
      DNSRecord(
        "@",
        "SOA",
        dnsFullName(service.domainName),
        dnsFullName(this.administratorEmail.replace(/@/, ".")),
        `(${this.soaUpdates.join(" ")})`
      ),
      DNSRecord("@", "NS", dnsFullName(service.address()))
    ];
  }

  get domains() {
    return this.entries.reduce(
      (all, net) => all.union(net.localDomains),
      new Set()
    );
  }

  get zones() {
    const zs = new Map();

    
    for (const source of this.entries) {
      for (const domain of source.localDomains) {
        const config = new bind_zone_config(this, `${domain}.zone.conf`);

        this.zoneConfigs.push(config);

        const z = new bind_zone(this, domain, config, source);

        zs.set(z.id, z);

        for (const {
          address,
          subnet,
          networkInterface,
          domainNames,
          family
        } of source.networkAddresses()) {
          //  console.log(address);
        }
      }
    }
    return zs;
  }

  async packageContent(outputControl) {
    outputControl.packageData.sources.push(
      ...(await Array.fromAsync(
        this.templateContent(...outputControl.permissions)
      ))
    );

    return (
      await Promise.all([
        this.generateACLs(outputControl),
        this.generateZoneDefs(outputControl, this.entries)
      ])
    ).find(r => r)
      ? true
      : false;
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

      return true;
    }

    return false;
  }

  async generateZoneDefs(outputControl, sources) {
    for (const source of sources) {
      console.log(
        "ZONE",
        source.toString(),
        [...source.localDomains].join(" ")
      );

      for (const domain of source.localDomains) {
        const locationName = source.name;
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
            addressesStatement(
              "allow-update",
              this.allowedUpdates,
              "none;",
              "  "
            )
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

function addressesStatement(prefix, objects, empty = false, indent = "") {
  const body = asArray(objects).map(
    value => `${indent}  ${typeof value === "string" ? value : value.name};`
  );

  if (body.length) {
    return [`${indent}${prefix} {`, body, `${indent}};`];
  }

  if (empty) {
    return [`${indent}${prefix} {`, indent + "  " + empty, `${indent}};`];
  }

  return [];
}

export class bind extends ExtraSourceService {
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
      type: networkAddressType
    }
  };
  static service = {
    extends: ["dns"],
    systemdService: "named.service",
    systemUserName: "named",
    systemGroupName: "named",
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

  get serverType() {
    return this.primaries ? "secondary" : "primary";
  }

  async writeForwarders(outputControl) {
    const forwarders = serviceEndpoints(this.source, {
      services: "services[types[dns] && priority>=100 && priority<200]",
      endpoints: endpoint => endpoint.family !== FAMILY_DNS,
      select: e => e.address,
      limit: 5
    });

    if (forwarders.length) {
      await writeLines(
        join(outputControl.dir, "etc/named/options"),
        `forwarders.conf`,
        addressesStatement("forwarders", forwarders)
      );

      return true;
    }

    return false;
  }

  async *preparePackages(dir) {
    const permissions = this.packageContentPermissions;
    const packageData = this.packageData;

    packageData.sources = await Array.fromAsync(
      this.templateContent(...permissions)
    );

    let hasContent = packageData.sources.length > 0;

    packageData.sources.push(
      new FileContentProvider(dir + "/", ...permissions)
    );

    const outputControl = newOutputControl(packageData, dir, permissions);

    for (const group of this.groups.values()) {
      const present = await group.packageContent(outputControl);
      hasContent ||= present;
    }

    const present = await this.writeForwarders(outputControl);

    if (hasContent || present) {
      //console.log(packageData);
      yield packageData;
    }
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
        zone.records.add(DNSRecord("location", "TXT", host.owner.name));
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

function newOutputControl(packageData, dir, permissions) {
  return { configs: [], catalogs: new Map(), packageData, dir, permissions };
}
