import { join } from "node:path";
import { createHmac } from "node:crypto";
import { FileContentProvider } from "npm-pkgbuild";
import { reverseArpa, FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import {
  default_collection_attribute,
  default_collection_attribute_writable,
  default_attribute_writable,
  duration_attribute_writable,
  name_attribute,
  string_attribute,
  string_set_attribute,
  string_attribute_writable,
  boolean_attribute,
  boolean_attribute_writable_true,
  boolean_attribute_writable_false,
  integer_attribute_writable,
  integer_attribute
} from "pacc";
import {
  Base,
  CoreService,
  Endpoint,
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
import { NetworkAddress } from "../network-address.mjs";

const bindNetworkAddressTypes = networkAddressType + "|bind_group";

class bind_zone extends Base {
  static priority = 1;
  static key = "id";
  static attributes = {
    id: { ...name_attribute, name: "id" },
    file: { ...string_attribute, name: "file" },
    records: {
      ...string_attribute_writable,
      collection: true,
      name: "records"
    },
    foreign: { ...boolean_attribute, name: "foreign" }
  };

  static {
    addType(this);
  }

  get isCatalog() {
    return false;
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

  get file() {
    return `${this.directory}/${this.domain}.zone`;
  }

  constructor(owner, id, config, location) {
    super(owner);
    this.id = id;
    this.config = config;
    this.directory = location;
    this.records = new Set(owner.defaultRecords);

    if (!this.isCatalog && owner.hasLocationRecord) {
      this.records.add(DNSRecord("location", "TXT", location));
    }

    config.zones.push(this);
  }
}

class catalog_zone extends bind_zone {
  static attributes = {
    version: { ...string_attribute, name: "version" },
    isCatalog: { ...boolean_attribute, name: "isCatalog" }
  };

  static {
    addType(this);
  }

  constructor(owner, id, config, location) {
    super(owner, id, config, location);
    this.records.add(DNSRecord("version", "TXT", `"${this.version}"`));
  }

  get isCatalog() {
    return true;
  }

  get version() {
    return "2";
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

  /** @type {bind_zone[]} */ zones = [];

  get type() {
    return this.owner.service.serverType;
  }

  constructor(owner, name) {
    super(owner);
    this.name = name;
  }

  async write(outputControl) {
    const dir = outputControl.dir;
    const group = this.owner;

    console.log(
      `config: ${group.name}/${this.name}${this.foreign ? " foreign" : ""}`
    );

    const content = [];

    for (const zone of this.zones) {
      console.log(`  file: ${zone.file}`);

      content.push(`zone \"${zone.id}\" {`);

      if (group.sharedWith) {
        content.push(`  in-view ${group.sharedWith.name};`);
      } else {
        content.push(`  type ${this.type};`);
        content.push(`  file \"${zone.file}\";`);

        switch (this.type) {
          case "primary":
            content.push(
              addressesStatement(
                "allow-update",
                group.allowUpdate,
                "none;",
                "  "
              )
            );
            break;
          case "secondary":
            content.push(`  primaries { 192.168.1.250; };`);
            break;
        }
        content.push(`  notify ${yesno(group.notify)};`);
      }
      content.push(`};`, "");

      let maxKeyLength = 0;
      for (const r of zone.records) {
        if (r.key.length > maxKeyLength) {
          maxKeyLength = r.key.length;
        }
      }

      await writeLines(
        join(dir, "var/lib/named"),
        zone.file,
        [...zone.records]
          .sort(sortZoneRecords)
          .map(r => r.toString(maxKeyLength, group.recordTTL))
      );
    }

    await writeLines(join(dir, `etc/named/${group.name}`), this.name, content);
  }
}

class bind_object extends Base {
  static priority = 1;
  static attributes = {
    order: { ...integer_attribute, name: "order" },
    entries: {
      ...default_collection_attribute_writable,
      type: NetworkAddress,
      name: "entries",
      deferredExpression: true
    }
  };

  static {
    addType(this);
  }

  get order() {
    return 0;
  }

  get service() {
    return this.owner;
  }
}

export class bind_acl extends bind_object {
  static priority = 1;

  static {
    addType(this);
  }

  async packageContent(outputControl) {
    const acls = addressesStatement(
      `acl ${this.name}`,
      addresses(this.entries, { aggregate: true })
    );

    if (acls.length) {
      await writeLines(
        join(outputControl.dir, "etc/named"),
        `${this.order}-acl-${this.name}.conf`,
        acls
      );

      return true;
    }

    return false;
  }
}

const acl_attribute = {
  ...default_attribute_writable,
  type: bind_acl,
  name: "acl",
  default: "'any'"
};

class bind_group extends bind_object {
  static priority = 1;
  static attributes = {
    matchClients: {
      ...acl_attribute,
      name: "matchClients"
    },
    allowUpdate: {
      ...acl_attribute,
      name: "allowUpdate"
    },
    allowQuery: {
      ...acl_attribute,
      name: "allowQuery"
    },
    allowQueryCache: {
      ...acl_attribute,
      name: "allowQueryCache"
    },
    allowRecursion: {
      ...acl_attribute,
      name: "allowRecursion"
    },
    allowTransfer: {
      ...acl_attribute,
      name: "allowTransfer"
    },
    domains: {
      ...string_set_attribute,
      name: "domains"
    },
    foreignDomains: {
      ...string_set_attribute,
      name: "foreignDomains"
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
    notify: { ...boolean_attribute_writable_false, name: "notify" },
    hasCatalog: { ...boolean_attribute_writable_false, name: "hasCatalog" },
    hasReverse: { ...boolean_attribute_writable_false, name: "hasReverse" },
    hasSVRRecords: {
      ...boolean_attribute_writable_false,
      name: "hasSVRRecords"
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
      default: Math.ceil(Date.now() / (1000 * 60)) * 60
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

  foreignDomains = new Set();
  notify = true;
  hasCatalog = true;
  hasSVRRecords = true;
  recordTTL = "1W";

  /**
   * Type of the group.
   * @return {string} view | unknown
   */
  get type() {
    if (this.sharedWith || this.entries) {
      return "view";
    }

    return "unknown";
  }

  get order() {
    return this.sharedWith ? this.sharedWith.order + 1 : 0;
  }

  get soaUpdates() {
    return [this.serial, this.refresh, this.retry, this.expire, this.minimum];
  }

  get defaultRecords() {
    const service = this.service;

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
    return this.entries?.reduce(
      (all, address) => all.union(address.domains),
      new Set()
    );
  }

  get zoneConfigs() {
    this.zones;
    return this._zoneConfigs || new Map();
  }

  intoCatalog(zone, locationName) {
    if (this.hasCatalog) {
      const catalogConfig = this.zoneConfigs.getOrInsertComputed(
        `catalog.${locationName}`,
        id => new bind_zone_config(this, `${id}.zone.conf`)
      );

      const catalogZone = this._zones.getOrInsertComputed(
        `catalog.${locationName}`,
        id => new catalog_zone(this, id, catalogConfig, locationName)
      );

      const hash = createHmac("sha1", zone.id).digest("hex");
      catalogZone.records.add(
        DNSRecord(`${hash}.zones`, "PTR", dnsFullName(zone.id))
      );
    }

    return zone;
  }

  get zones() {
    const e = this.entries;
    const entries = e === undefined ? [] : [...e];

    if (!this._zones && entries.length > 0) {
      this._zoneConfigs = new Map();
      this._zones = new Map();

      const hosts = new Set();
      const addresses = new Set();

      //console.log("ZONES for", this.owner.owner.name, this.name);

      for (const na of entries) {
        const address = na.address;
        const host = na.host;

        if (host && !addresses.has(address)) {
          addresses.add(address);

          const locationName = host.owner.name;

          for (const domain of na.domains) {
            const config = this.zoneConfigs.getOrInsertComputed(
              domain,
              domain => new bind_zone_config(this, `${domain}.zone.conf`)
            );

            const zone = this._zones.getOrInsertComputed(domain, domain =>
              this.intoCatalog(
                new bind_zone(this, domain, config, locationName),
                locationName
              )
            );

            const reverseZone =
              this.hasReverse &&
              na.subnet.prefix &&
              this._zones.getOrInsertComputed(
                reverseArpa(na.subnet.prefix),
                domain =>
                  this.intoCatalog(
                    new bind_zone(this, domain, config, locationName),
                    locationName
                  )
              );

            if (!hosts.has(host)) {
              hosts.add(host);

              for (let foreignDomain of host.foreignDomainNames) {
                const wildcard = foreignDomain.startsWith("*.");
                if (wildcard) {
                  foreignDomain = foreignDomain.substring(2);
                }

                this.foreignDomains.add(foreignDomain);

                const config = this.zoneConfigs.getOrInsertComputed(
                  foreignDomain,
                  domain => new bind_zone_config(this, `${domain}.zone.conf`)
                );

                config.foreign = true;
                const zone = this._zones.getOrInsertComputed(
                  foreignDomain,
                  domain =>
                    this.intoCatalog(
                      new bind_zone(this, domain, config, locationName),
                      locationName
                    )
                );

                zone.foreign = true;

                for (const na of host.networkAddresses(
                  na => na.networkInterface.kind !== "loopback"
                )) {
                  zone.records.add(
                    DNSRecord(
                      "@",
                      dnsRecordTypeForAddressFamily(na.family),
                      na.address
                    )
                  );

                  if (wildcard) {
                    zone.records.add(
                      DNSRecord(
                        "*",
                        dnsRecordTypeForAddressFamily(na.family),
                        na.address
                      )
                    );
                  }
                }
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

            for (const domainName of na.domainNames) {
              if (domainName.endsWith(domain) && domainName[0] !== "*") {
                zone.records.add(
                  DNSRecord(
                    dnsFullName(domainName),
                    dnsRecordTypeForAddressFamily(na.family),
                    address
                  )
                );

                if (reverseZone) {
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
          }
        }
      }
    }
    return this._zones;
  }

  async packageContent(outputControl) {
    outputControl.packageData.sources.push(
      ...(await Array.fromAsync(
        this.templateContent(...outputControl.permissions)
      ))
    );

    for (const config of this.zoneConfigs.values()) {
      await config.write(outputControl);
    }

    if (this.foreignDomains.size) {
      addHook(
        outputControl.packageData,
        "post_upgrade",
        `/usr/bin/named-hostname-update ${[...this.foreignDomains].join(" ")}`
      );
    }

    return outputControl.packageData;
  }
}

/**
 *
 * @param {string} prefix
 * @param {any} objects
 * @param {boolean|string} empty
 * @param {string} indent
 * @returns {(string|string[])[]}
 */
function addressesStatement(prefix, objects, empty = false, indent = "") {
  const body = asArray(objects).map(value => {
    if (typeof value !== "string") {
      if (value.name) {
        value = value.name;
      } else {
        value = value.address;

        // console.log(value);
        //value = [...value];
      }
    }

    return `${indent}${value};`;
  });

  if (body.length) {
    return [`${indent}${prefix} {`, body, `${indent}};`];
  }

  if (empty) {
    return [`${indent}${prefix} {`, indent + "  " + empty, `${indent}};`];
  }

  return [];
}

export class bind extends CoreService {
  static attributes = {
    forwarders: {
      ...default_collection_attribute_writable,
      type: Endpoint,
      name: "forwarders",
      deferredExpression: true
    },
    primaries: {
      ...default_collection_attribute_writable,
      name: "primaries",
      type: networkAddressType,
      deferredExpression: true
    },
    acls: {
      ...default_collection_attribute_writable,
      name: "acls",
      type: bind_acl,
      backpointer: owner_attribute
    },
    groups: {
      ...default_collection_attribute_writable,
      name: "groups",
      type: bind_group,
      backpointer: owner_attribute
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

  acls = new Map();
  groups = new Map();

  get serverType() {
    return this.primaries ? "secondary" : "primary";
  }

  async writeForwarders(outputControl) {
    // TODO formulate everything as pacc expression
    const forwarders = [...this.forwarders]
      .map(e => e.endpoints())
      .flat()
      .filter(e => e.networkAddress)
      .map(e => e.networkAddress?.address);

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

    const outputControl = { packageData, dir, permissions };

    for (const acl of this.acls.values()) {
      const present = await acl.packageContent(outputControl);
      hasContent ||= present;
    }

    for (const group of this.groups.values()) {
      const present = await group.packageContent(outputControl);
      hasContent ||= present;
    }

    const present = await this.writeForwarders(outputControl);

    if (hasContent || present) {
      yield packageData;
    }
  }
}
