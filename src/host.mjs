import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { AggregatedMap } from "aggregated-map";
import {
  string_attribute,
  string_attribute_writable,
  number_attribute_writable,
  priority_attribute,
  asArray
} from "pacc";
import { addresses, addType, assign } from "pmcf";
import {
  networkAddressAttributes,
  networkInterfaces_attribute,
  hosts_attribute,
  extends_attribute
} from "./common-attributes.mjs";
import { ServiceOwner } from "./service-owner.mjs";
import { addHook } from "./hooks.mjs";
import { domainFromDominName, domainName, writeLines } from "./utils.mjs";
import { generateKnownHosts } from "./host-utils.mjs";

export class Host extends ServiceOwner {
  static name = "host";
  static priority = 1.9;
  static attributes = {
    ...networkAddressAttributes,
    networkInterfaces: networkInterfaces_attribute,
    os: {
      ...string_attribute_writable,
      name: "os",
      values: new Set(["osx", "windows", "linux"])
    },
    id: { ...string_attribute_writable, name: "id" },
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
    extends: {
      ...extends_attribute,
      type: Host
    },
    model: { ...string_attribute, name: "model" }
  };

  static {
    addType(this);
  }

  _networkInterfaces = new Map();
  _os;
  _distribution;
  _deployment;
  _chassis;
  _vendor;
  _architecture;
  _serial;
  _keymap;

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

  get services() {
    return new AggregatedMap([
      this._services,
      ...this._networkInterfaces.values().map(ni => ni._services)
    ]);
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
    return readFile(
      join(this.directory, "content", "etc", "ssh", `ssh_host_${type}_key.pub`),
      "utf8"
    );
  }

  async *preparePackages(dir) {
    const packageData = await this.packageData;

    packageData.sources.push(
      ...await Array.fromAsync(this.templateContent()),
      new FileContentProvider({
        dir,
        pattern: ["**/*", "**/.ssh/*"],
        permissions: this.content.permissions
      })
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
