import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { AggregatedMap } from "aggregated-map";
import {
  default_collection_attribute_writable,
  string_attribute,
  string_attribute_writable,
  string_set_attribute_writable,
  number_attribute_writable,
  priority_attribute
} from "pacc";
import { addresses, addType, assign } from "pmcf";
import {
  networkAddressAttributes,
  networkInterfaces_attribute,
  hosts_attribute
} from "./common-attributes.mjs";
import { ServiceOwner } from "./service-owner.mjs";
import { addHook } from "./hooks.mjs";
import {
  domainFromDominName,
  domainName,
  writeLines,
  asArray,
  union
} from "./utils.mjs";
import { loadHooks } from "./hooks.mjs";
import { generateKnownHosts } from "./host-utils.mjs";

export class Host extends ServiceOwner {
  static name = "host";
  static priority = 1.9;
  static attributes = {
    ...networkAddressAttributes,
    networkInterfaces: networkInterfaces_attribute,
    aliases: { ...string_set_attribute_writable, name: "aliases" },
    os: {
      ...string_attribute_writable,
      name: "os",
      values: new Set(["osx", "windows", "linux"])
    },
    "machine-id": { ...string_attribute_writable, name: "machine-id" },
    distribution: { ...string_attribute_writable, name: "distribution" },
    deployment: {
      ...string_attribute_writable,
      name: "deployment",
      values: new Set(["production", "development"])
    },
    priority: priority_attribute,
    weight: { ...number_attribute_writable, name: "weight" },
    serial: { ...string_attribute_writable, name: "serial" },
    vendor: { ...string_attribute_writable, name: "vendor" },
    keymap: { ...string_attribute_writable, name: "keymap" },
    chassis: {
      ...string_attribute_writable,
      name: "chassis",
      values: new Set([
        "phone",
        "tablet",
        "router",
        "gateway",
        "desktop",
        "notebook",
        "server",
        "monitor",
        "camera",
        "inverter",
        "battery",
        "virtual",
        "dehumidifier"
      ])
    },
    architecture: {
      ...string_attribute_writable,
      name: "architecture",
      values: new Set(["x86", "x86_64", "aarch64", "armv7", "riscv"])
    },
    replaces: { ...string_set_attribute_writable, name: "replaces" },
    depends: { ...string_set_attribute_writable, name: "depends" },
    provides: { ...string_set_attribute_writable, name: "provides" },
    extends: {
      ...default_collection_attribute_writable,
      name: "extends",
      type: Host
    },
    model: { ...string_attribute, name: "model" }
  };

  static {
    addType(this);
  }

  _aliases = new Set();
  _networkInterfaces = new Map();
  _provides = new Set();
  _replaces = new Set();
  _depends = new Set();
  _optional = new Set();
  _os;
  _distribution;
  _deployment;
  _chassis;
  _vendor;
  _architecture;
  _serial;
  _keymap;

  materializeExtends() {
    super.materializeExtends();

    for (const host of this.walkDirections(["extends"])) {
      for (const ni of host.networkInterfaces.values()) {
        const present = this.networkInterfaces.get(ni.name);

        if (present) {
          present.extends.add(ni);
          present.materializeExtends();
        } else {
          this.networkInterfaces.set(ni.name, ni.forOwner(this));
        }
      }
    }
  }

  set serial(value) {
    this._serial = value;
  }

  get serial() {
    return this.attribute("_serial");
  }

  set deployment(value) {
    this._deployment = value;
  }

  get deployment() {
    return this.attribute("_deployment");
  }

  set chassis(value) {
    this._chassis = value;
  }

  get chassis() {
    return this.attribute("_chassis");
  }

  set vendor(value) {
    this._vendor = value;
  }

  get vendor() {
    return this.attribute("_vendor");
  }

  /**
   * @return {string}
   */
  get id() {
    return this["machine-id"];
  }

  set keymap(value) {
    this._keymap = value;
  }

  get keymap() {
    return this.attribute("_keymap");
  }

  set architecture(value) {
    this._architecture = value;
  }

  get architecture() {
    return this.attribute("_architecture");
  }

  get derivedPackaging() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_packaging")
    );
  }

  get isTemplate() {
    return this.isModel || super.isTemplate;
  }

  get isModel() {
    return this._vendor || this._chassis ? true : false;
  }

  get model() {
    for (const node of this.walkDirections(["this", "extends"])) {
      if (node.isModel) {
        return node;
      }
    }
  }

  set aliases(value) {
    this._aliases = union(value, this._aliases);
  }

  get aliases() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_aliases")
    );
  }

  set provides(value) {
    this._provides = union(value, this._provides);
  }

  get provides() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_provides")
    );
  }

  set replaces(value) {
    this._replaces = union(value, this._replaces);
  }

  get replaces() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_replaces")
    );
  }

  set depends(value) {
    this._depends = union(value, this._depends);
  }

  get depends() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_depends")
    );
  }

  set optional(value) {
    this._optional = union(value, this._optional);
  }

  get optional() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_optional")
    );
  }

  set os(value) {
    this._os = value;
  }

  get os() {
    return this.attribute("_os");
  }

  set distribution(value) {
    this._distribution = value;
  }

  get distribution() {
    return this.attribute("_distribution");
  }

  get modelName() {
    return this.model?.hostName;
  }

  get hostName() {
    const parts = this.name.split(/\//);
    return parts[parts.length - 1].toLowerCase();
  }

  get foreignDomainNames() {
    return [...this.aliases].filter(n => n.split(".").length > 1);
  }

  get foreignDomains() {
    return new Set(
      [...this.aliases]
        .map(n => domainFromDominName(n, this.domain))
        .filter(domain => domain !== undefined)
    );
  }

  get domains() {
    return this.foreignDomains.union(this.localDomains);
  }

  get directDomainNames() {
    return new Set(
      [this.hostName, ...this.aliases].map(n => domainName(n, this.domain))
    );
  }

  /**
   * @return {Set<string>}
   */
  get domainNames() {
    return new Set(
      [
        ...[...this.networkInterfaces.values()].reduce(
          (all, networkInterface) => all.union(networkInterface.domainNames),
          this.directDomainNames
        )
      ].map(n => domainName(n, this.domain))
    );
  }

  get domainName() {
    return domainName(this.hostName, this.domain);
  }

  *domainNamesIn(domain) {
    for (const domainName of this.domainNames) {
      if (domain === domainFromDominName(domainName)) {
        yield domainName;
      }
    }
  }

  get clusters() {
    const clusters = new Set();

    for (const ni of this.networkInterfaces.values()) {
      if (ni.cluster) {
        clusters.add(ni.cluster);
      }
    }

    return clusters;
  }

  get host() {
    return this;
  }

  get hosts() {
    return [this];
  }

  get network() {
    for (const ni of this.networkInterfaces.values()) {
      if (ni._kind !== "loopback" && ni._network) {
        return ni._network;
      }
    }

    return super.network;
  }

  get networks() {
    return new Set(
      [...this.networkInterfaces.values()]
        .filter(ni => ni._network)
        .map(ni => ni._network)
    );
  }

  get networkInterfaces() {
    return this._networkInterfaces;
  }

  set networkInterfaces(networkInterface) {
    this._networkInterfaces.set(networkInterface.name, networkInterface);

    if (!this.isTemplate && networkInterface.network) {
      assign(hosts_attribute, networkInterface.network, this);
      //networkInterface.network.hosts = this;
    }
  }

  *networkAddresses(filter) {
    for (const networkInterface of this.networkInterfaces.values()) {
      yield* networkInterface.networkAddresses(filter);
    }
  }

  get address() {
    return this.addresses[0];
  }

  get addresses() {
    return addresses(this.networkAddresses());
  }

  get subnets() {
    return new AggregatedMap(
      [...this.networkInterfaces.values()].map(ni => ni.subnets)
    );
  }

  async publicKey(type = "ed25519") {
    return readFile(join(this.directory, `ssh_host_${type}_key.pub`), "utf8");
  }

  async *preparePackages(dir) {
    const packageData = this.packageData;
    packageData.sources.push(
      await Array.fromAsync(this.templateContent()),
      new FileContentProvider(
        { dir: this.directory, pattern: "*.pub" },
        { destination: "/etc/ssh/", mode: 0o644 }
      ),
      new FileContentProvider(
        { dir: this.directory, pattern: "*_key" },
        { destination: "/etc/ssh/", mode: 0o600 }
      ),
      new FileContentProvider({ dir, pattern: ["**/*", "**/.ssh/*"] })
    );

    Object.assign(packageData.properties, {
      description: `${this.typeName} definitions for ${this.fullName}`,
      dependencies: [...this.depends],
      provides: [...this.provides],
      replaces: [...this.replaces],
      depends: [...this.depends],
      optional: [...this.optional],
      backup: "root/.ssh/known_hosts"
    });

    await loadHooks(
      packageData,
      new URL("host.install", import.meta.url).pathname
    );

    for (const ni of this.networkInterfaces.values()) {
      await ni.systemdDefinitions(dir, packageData);
    }

    await generateKnownHosts(
      this.owner.hosts.values(),
      join(dir, "root", ".ssh")
    );

    for (const [name, service] of this.services) {
      if (service.systemdConfigs) {
        for (const { serviceName, configFileName, content } of asArray(
          service.expand(service.systemdConfigs(this.name))
        )) {
          //console.log("SERVICE", service.fullName, configFileName);

          await writeLines(dir, configFileName, content);

          addHook(
            packageData,
            "post_install",
            `systemctl enable ${serviceName}`
          );
        }
      }
    }

    yield packageData;
  }
}
