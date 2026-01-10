import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import {
  default_attribute_writable,
  string_attribute,
  string_attribute_writable,
  string_collection_attribute_writable,
  number_attribute_writable,
  boolean_attribute_false,
  addType
} from "pacc";
import { ServiceOwner, Base, addresses } from "pmcf";
import { networkAddressAttributes } from "./network-support.mjs";
import { addHook } from "./hooks.mjs";
import {
  domainFromDominName,
  domainName,
  writeLines,
  sectionLines,
  asArray
} from "./utils.mjs";
import { loadHooks } from "./hooks.mjs";
import { generateMachineInfo, generateKnownHosts } from "./host-utils.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interfaces/network-interface.mjs";

const HostTypeDefinition = {
  name: "host",
  owners: ["owner", "network", "root"],
  extends: Base.typeDefinition,
  key: "name",
  attributes: {
    ...networkAddressAttributes,
    networkInterfaces: {
      ...default_attribute_writable,
      type: "network_interface",
      collection: true
    },
    services: {
      ...default_attribute_writable,
      type: "service",
      collection: true
    },
    aliases: string_collection_attribute_writable,
    os: {
      ...string_attribute_writable,
      values: ["osx", "windows", "linux"]
    },
    "machine-id": string_attribute_writable,
    distribution: string_attribute_writable,
    deployment: {
      ...string_attribute_writable,
      values: ["production", "development"]
    },
    weight: number_attribute_writable,
    serial: string_attribute_writable,
    vendor: string_attribute_writable,
    keymap: string_attribute_writable,
    chassis: {
      ...string_attribute_writable,
      values: [
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
      ]
    },
    architecture: {
      ...string_attribute_writable,
      values: ["x86", "x86_64", "aarch64", "armv7"]
    },
    replaces: string_collection_attribute_writable,
    depends: string_collection_attribute_writable,
    provides: string_collection_attribute_writable,
    extends: { ...default_attribute_writable, type: "host", collection: true },
    model: string_attribute,
    isModel: boolean_attribute_false
  }
};

export class Host extends ServiceOwner {
  _aliases = new Set();
  _networkInterfaces = new Map();
  _provides = new Set();
  _replaces = new Set();
  _depends = new Set();
  _os;
  _distribution;
  _deployment;
  _chassis;
  _vendor;
  _architecture;
  _serial;
  _keymap;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return HostTypeDefinition;
  }

  read(data, type) {
    super.read(data, type);

    this.extra = data.extra;
  }

  _applyExtends(host) {
    super._applyExtends(host);
    for (const [name, ni] of host.networkInterfaces) {
      const present = this._networkInterfaces.get(name);

      if (present) {
        present.extends.push(ni);
      } else {
        this._networkInterfaces.set(name, ni.forOwner(this));
      }
    }
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const ni of this.networkInterfaces.values()) {
        ni._traverse(...args);
      }
      return true;
    }
    return false;
  }

  set serial(value) {
    this._serial = value;
  }

  get serial() {
    return this.extendedProperty("_serial");
  }

  set deployment(value) {
    this._deployment = value;
  }

  get deployment() {
    return this.extendedProperty("_deployment");
  }

  set chassis(value) {
    this._chassis = value;
  }

  get chassis() {
    return this.extendedProperty("_chassis");
  }

  set vendor(value) {
    this._vendor = value;
  }

  get vendor() {
    return this.extendedProperty("_vendor");
  }

  set keymap(value) {
    this._keymap = value;
  }

  get keymap() {
    return this.extendedProperty("_keymap");
  }

  set architecture(value) {
    this._architecture = value;
  }

  get architecture() {
    return this.extendedProperty("_architecture");
  }

  get derivedPackaging() {
    return this.extends.reduce((a, c) => a.union(c.packaging), new Set());
  }

  get isTemplate() {
    return this.isModel || super.isTemplate;
  }

  get isModel() {
    return this._vendor || this._chassis ? true : false;
  }

  get model() {
    return this.extends.find(h => h.isModel);
  }

  set aliases(value) {
    if (value instanceof Set) {
      this._aliases = this._aliases.union(value);
    } else {
      this._aliases.add(value);
    }
  }

  get aliases() {
    return this.extends.reduce((a, c) => a.union(c.aliases), this._aliases);
  }

  set provides(value) {
    if (value instanceof Set) {
      this._provides = this._provides.union(value);
    } else {
      this._provides.add(value);
    }
  }

  get provides() {
    return this.expand(
      this.extends.reduce((a, c) => a.union(c.provides), this._provides)
    );
  }

  set replaces(value) {
    if (value instanceof Set) {
      this._replaces = this._replaces.union(value);
    } else {
      this._replaces.add(value);
    }
  }

  get replaces() {
    return this.expand(
      this.extends.reduce((a, c) => a.union(c.replaces), this._replaces)
    );
  }

  set depends(value) {
    if (value instanceof Set) {
      this._depends = this._depends.union(value);
    } else {
      this._depends.add(value);
    }
  }

  get depends() {
    return this.expand(
      this.extends.reduce((a, c) => a.union(c.depends), this._depends)
    );
  }

  set os(value) {
    this._os = value;
  }

  get os() {
    return this.extendedProperty("_os");
  }

  set distribution(value) {
    this._distribution = value;
  }

  get distribution() {
    return this.extendedProperty("_distribution");
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
      [...this.aliases].map(n => domainFromDominName(n, this.domain))
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

  *hosts() {
    yield this;
  }

  typeNamed(typeName, name) {
    if (typeName === NetworkInterfaceTypeDefinition.name) {
      const ni = this._networkInterfaces.get(name);
      if (ni) {
        return ni;
      }
    }
    return super.typeNamed(typeName, name);
  }

  named(name) {
    const ni = this._networkInterfaces.get(name);
    if (ni) {
      return ni;
    }

    return super.named(name);
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

    if (!this.isTemplate) {
      networkInterface.network?.addObject(this);
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
    const sn = new Map();

    for (const networkInterface of this.networkInterfaces.values()) {
      for (const s of networkInterface.subnets()) {
        sn.set(s.address, s);
      }
    }

    return new Set(sn.values());
  }

  async publicKey(type = "ed25519") {
    return readFile(join(this.directory, `ssh_host_${type}_key.pub`), "utf8");
  }

  async *preparePackages(dir) {
    const pkgName = `${this.typeName}-${this.owner.name}-${this.name}`;
    let packageData = {
      dir,
      sources: [
        new FileContentProvider(
          { base: this.directory, pattern: "*.pub" },
          { destination: "/etc/ssh/", mode: 0o644 }
        ),
        new FileContentProvider(
          { base: this.directory, pattern: "*_key" },
          { destination: "/etc/ssh/", mode: 0o600 }
        ),
        new FileContentProvider(dir + "/")
      ],
      outputs: this.outputs,
      properties: {
        name: pkgName,
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private",
        dependencies: [
          `${this.location.typeName}-${this.location.name}`,
          ...this.depends
        ],
        provides: [...this.provides],
        replaces: [...this.replaces],
        requires: [],
        backup: "root/.ssh/known_hosts",
        hooks: await loadHooks(
          {},
          new URL("host.install", import.meta.url).pathname
        )
      }
    };

    for (const ni of this.networkInterfaces.values()) {
      await ni.systemdDefinitions(packageData);
    }

    if (this.keymap) {
      await writeLines(dir, "etc/vconsole.conf", `KEYMAP=${this.keymap}`);
    }

    await generateMachineInfo(this, packageData);
    await generateKnownHosts(this.owner.hosts(), join(dir, "root", ".ssh"));

    for (const service of this.services) {
      if (service.systemdConfigs) {
        for (const { serviceName, configFileName, content } of asArray(
          service.expand(service.systemdConfigs(this.name))
        )) {
          await writeLines(dir, configFileName, content);

          addHook(
            packageData.properties.hooks,
            "post_install",
            `systemctl enable ${serviceName}`
          );
        }
      }
    }

    yield packageData;

    if (this.extra) {
      packageData = {
        dir,
        sources: [new FileContentProvider(join(this.directory, "extra") + "/")],
        outputs: this.outputs,
        properties: {
          name: `${this.typeName}-extra-${this.owner.name}-${this.name}`,
          description: `additional files for ${this.fullName}`,
          access: "private",
          dependencies: [pkgName]
        }
      };

      yield packageData;
    }
  }
}
