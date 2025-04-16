import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { ServiceOwner, Base } from "pmcf";
import { networkAddressProperties, addresses } from "./network-support.mjs";
import {
  domainFromDominName,
  domainName,
  writeLines,
  sectionLines
} from "./utils.mjs";
import { objectFilter } from "./filter.mjs";
import { addType, types } from "./types.mjs";
import { loadHooks } from "./hooks.mjs";
import { generateMachineInfo, generateKnownHosts } from "./host-utils.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interfaces/network-interface.mjs";

const HostTypeDefinition = {
  name: "host",
  priority: 0.5,
  owners: ["owner", "network", "root"],
  extends: Base.typeDefinition,
  properties: {
    ...networkAddressProperties,
    networkInterfaces: {
      type: "network_interface",
      collection: true,
      writeable: true
    },
    services: { type: "service", collection: true, writeable: true },
    aliases: { type: "string", collection: true, writeable: true },
    os: {
      type: "string",
      collection: false,
      writeable: true,
      values: ["osx", "windows", "linux"]
    },
    "machine-id": { type: "string", collection: false, writeable: true },
    distribution: { type: "string", collection: false, writeable: true },
    deployment: {
      type: "string",
      collection: false,
      writeable: true,
      values: ["production", "development"]
    },
    weight: { type: "number", collection: false, writeable: true },
    serial: { type: "string", collection: false, writeable: true },
    vendor: { type: "string", collection: false, writeable: true },
    chassis: {
      type: "string",
      collection: false,
      writeable: true,
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
        "virtual"
      ]
    },
    architecture: {
      type: "string",
      collection: false,
      writeable: true,
      values: ["x86", "x86_64", "aarch64", "armv7"]
    },
    replaces: { type: "string", collection: true, writeable: true },
    depends: { type: "string", collection: true, writeable: true },
    provides: { type: "string", collection: true, writeable: true },
    extends: { type: "host", collection: true, writeable: true },
    model: { type: "string", collection: false, writeable: false },
    isModel: { type: "boolean", collection: false, writeable: false }
  }
};

export class Host extends ServiceOwner {
  _extends = [];
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

  static {
    addType(this);
  }

  static get typeDefinition() {
    return HostTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);

    this.read(data, HostTypeDefinition);

    owner.addObject(this);

    if (data.extends) {
      this.finalize(() => {
        for (const host of this.extends) {
          host.execFinalize();
          this._applyExtends(host);
        }
      });
    }
  }

  _applyExtends(host) {
    for (const service of host.services) {
      //present.extends.push(service);

      this.services = service.forOwner(this);
    }

    for (const [name, ni] of host.networkInterfaces) {
      if (ni.isTemplate) {
      } else {
        let present = this._networkInterfaces.get(name);

        if (!present) {
          present = ni.forOwner(this);
          this._networkInterfaces.set(name, present);
        }

        present.extends.push(ni);
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
    return this.isModel || this.name.match(/services\//); // TODO
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

  set extends(value) {
    this._extends.push(value);
  }

  get extends() {
    return this._extends;
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
    return parts[parts.length - 1];
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

  *findNetworkInterfaces(filter) {
    yield* objectFilter(
      types.network_interface,
      this._networkInterfaces.values(),
      filter
    );
  }

  findNetworkInterface(filter) {
    for (const ni of objectFilter(
      types.network_interface,
      this._networkInterfaces.values(),
      filter
    )) {
      return ni;
    }
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

  *subnets() {
    for (const networkInterface of this.networkInterfaces.values()) {
      yield* networkInterface.subnets();
    }
  }

  async publicKey(type = "ed25519") {
    return readFile(join(this.directory, `ssh_host_${type}_key.pub`), "utf8");
  }

  async *preparePackages(dir) {
    const packageData = {
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
        name: `${this.typeName}-${this.owner.name}-${this.name}`,
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private",
        dependencies: [
          `${this.location.typeName}-${this.location.name}`,
          ...this.depends
        ],
        provides: [...this.provides],
        replaces: [`mf-${this.hostName}`, ...this.replaces],
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

    await generateMachineInfo(this, packageData);
    await generateKnownHosts(this.owner.hosts(), join(dir, "root", ".ssh"));

    for (const service of this.services) {
      if (service.systemdConfig) {
        const { name, content } = service.systemdConfig(this.name);
        await writeLines(dir, name, sectionLines(...content));
      }
    }

    yield packageData;
  }
}
