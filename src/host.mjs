import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Base } from "./base.mjs";
import {
  networkProperties,
  networkAddressProperties
} from "./network-support.mjs";
import {
  asArray,
  isIPv4Address,
  isIPv6Address,
  normalizeIPAddress,
  formatCIDR,
  hasWellKnownSubnet,
  domainFromDominName,
  domainName
} from "./utils.mjs";
import { objectFilter } from "./filter.mjs";
import { addType, types } from "./types.mjs";
import { loadHooks } from "./hooks.mjs";
import {
  generateNetworkDefs,
  generateMachineInfo,
  copySshKeys,
  generateKnownHosts
} from "./host-utils.mjs";

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
    chassis: { type: "string", collection: false, writeable: true },
    architecture: {
      type: "string",
      collection: false,
      writeable: true,
      values: ["x86", "aarch64", "armv7"]
    },
    replaces: { type: "string", collection: true, writeable: true },
    depends: { type: "string", collection: true, writeable: true },
    provides: { type: "string", collection: true, writeable: true },
    extends: { type: "host", collection: true, writeable: true },
    model: { type: "string", collection: false, writeable: false },
    isModel: { type: "boolean", collection: false, writeable: false }
  }
};

export class Host extends Base {
  _services = [];
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
      for (const service of this._services) {
        service._traverse(...args);
      }

      return true;
    }
    return false;
  }

  set serial(value) {
    this._serial = value;
  }

  get serial() {
    return this._serial ?? this.extends.find(e => e.serial)?.serial;
  }

  set deployment(value) {
    this._deployment = value;
  }

  get deployment() {
    return this._deployment ?? this.extends.find(e => e.deployment)?.deployment;
  }

  set chassis(value) {
    this._chassis = value;
  }

  get chassis() {
    return this._chassis ?? this.extends.find(e => e.chassis)?.chassis;
  }

  set vendor(value) {
    this._vendor = value;
  }

  get vendor() {
    return this._vendor ?? this.extends.find(e => e.vendor)?.vendor;
  }

  set architecture(value) {
    this._architecture = value;
  }

  get architecture() {
    return (
      this._architecture ?? this.extends.find(e => e.architecture)?.architecture
    );
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
    return this._os ?? this.extends.find(e => e.os)?.os;
  }

  set distribution(value) {
    this._distribution = value;
  }

  get distribution() {
    return (
      this._distribution ?? this.extends.find(e => e.distribution)?.distribution
    );
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

  get host() {
    return this;
  }

  get services() {
    return this._services;
  }

  set services(service) {
    const present = this._services.find(s => s.name === service.name);

    if (!present) {
      this._services.push(service);
    }
  }

  *findServices(filter) {
    yield* objectFilter(types.service, this._services, filter);
  }

  typeNamed(typeName, name) {
    if (typeName === NetworkInterfaceTypeDefinition.name) {
      const ni = this._networkInterfaces.get(name);
      if (ni) {
        return ni;
      }
    }
    if (typeName === "service") {
      const service = this.services.find(s => s.name === name);
      if (service) {
        return service;
      }
    }

    return super.typeNamed(typeName, name);
  }

  named(name) {
    const ni = this._networkInterfaces.get(name);
    if (ni) {
      return ni;
    }
    const service = this.services.find(s => s.name === name);
    if (service) {
      return service;
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

  *networkAddresses() {
    for (const networkInterface of this.networkInterfaces.values()) {
      for (const [address, subnet] of networkInterface.ipAddresses) {
        yield {
          networkInterface,
          domainNames: networkInterface.domainNames,
          address,
          subnet
        };
      }
    }
  }

  get rawAddress() {
    return this.rawAddresses[0];
  }

  get rawAddresses() {
    return [...this.networkAddresses()].map(na => na.address);
  }

  get cidrAddress() {
    return this.cidrAddresses[0];
  }

  get cidrAddresses() {
    return [...this.networkAddresses()].map(({ address, subnet }) =>
      formatCIDR(address, subnet)
    );
  }

  async publicKey(type = "ed25519") {
    return readFile(join(this.directory, `ssh_host_${type}_key.pub`), "utf8");
  }

  async *preparePackages(dir) {
    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")[Symbol.asyncIterator]()],
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

    await generateNetworkDefs(this, packageData);
    await generateMachineInfo(this, packageData);
    await copySshKeys(this, packageData);
    await generateKnownHosts(this.owner.hosts(), join(dir, "root", ".ssh"));

    yield packageData;
  }
}

const NetworkInterfaceTypeDefinition = {
  name: "network_interface",
  priority: 0.4,
  owners: ["host"],
  extends: Base.typeDefinition,
  properties: {
    ...networkProperties,
    ...networkAddressProperties,
    hostName: { type: "string", collection: false, writeable: true },
    ipAddresses: { type: "string", collection: true, writeable: true },

    hwaddr: { type: "string", collection: false, writeable: true },
    network: { type: "network", collection: false, writeable: true },
    destination: { type: "string", collection: false, writeable: true },
    arpbridge: { type: "network_interface", collection: true, writeable: true }
  }
};

export class NetworkInterface extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return NetworkInterfaceTypeDefinition;
  }

  _ipAddresses = new Map();
  _scope;
  _metric;
  _ssid;
  _psk;
  _network;
  _kind;
  _hostName;
  extends = [];
  arpbridge;
  hwaddr;

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NetworkInterfaceTypeDefinition);
  }

  get isTemplate() {
    return this.name.indexOf("*") >= 0;
  }

  matches(other) {
    if (this.isTemplate) {
      const name = this.name.replace("*", "");
      return name.length === 0 || other.name.indexOf(name) >= 0;
    }

    return false;
  }

  addSubnet(address) {
    if (!this.network) {
      if (!hasWellKnownSubnet(address)) {
        this.error("Missing network", address);
      }
    } else {
      return this.network.addSubnet(address);
    }
  }

  get ipAddresses() {
    return this._ipAddresses;
  }

  set ipAddresses(value) {
    for (const address of asArray(value)) {
      this._ipAddresses.set(
        normalizeIPAddress(address),
        this.addSubnet(address)
      );
    }
  }

  get rawAddress() {
    return this.rawAddresses[0];
  }

  get rawAddresses() {
    return [...this._ipAddresses].map(([address]) => address);
  }

  get cidrAddress() {
    return this.cidrAddresses[0];
  }

  get cidrAddresses() {
    return [...this._ipAddresses].map(([address, subnet]) =>
      formatCIDR(address, subnet)
    );
  }

  get rawIPv4Addresses() {
    return [...this.ipAddresses]
      .filter(([address]) => isIPv4Address(address))
      .map(([address]) => address);
  }

  get rawIPv6Addresses() {
    return [...this.ipAddresses]
      .filter(([address]) => isIPv6Address(address))
      .map(([address]) => address);
  }

  subnetForAddress(address) {
    return (
      this.network?.subnetForAddress(address) ||
      this.host.owner.subnetForAddress(address)
    );
  }

  get gateway() {
    return this.network?.gateway;
  }

  get gatewayAddress() {
    for (const a of this.gateway.networkAddresses()) {
      if (a.networkInterface.network === this.network) {
        return a.address;
      }
    }
  }

  get hostName() {
    return this._hostName ?? this.host.hostName;
  }

  set hostName(value) {
    this._hostName = value;
  }

  get domainNames() {
    return this.hostName
      ? new Set([[this.hostName, this.host.domain].join(".")])
      : this.host.directDomainNames;
  }

  get host() {
    return this.owner;
  }

  get network_interface() {
    return this;
  }

  get network() {
    return this._network ?? this.host.network;
  }

  set network(network) {
    this._network = network;
  }

  set scope(value) {
    this._scope = value;
  }

  get scope() {
    return this._scope ?? this.network?.scope ?? "global";
  }

  set metric(value) {
    this._metric = value;
  }

  get metric() {
    return this._metric ?? this.network?.metric ?? 1004;
  }

  set ssid(value) {
    this._ssid = value;
  }

  get ssid() {
    return this._ssid ?? this.network?.ssid;
  }

  set psk(value) {
    this._psk = value;
  }

  get psk() {
    return this._psk ?? this.network?.psk;
  }

  set kind(value) {
    this._kind = value;
  }

  get kind() {
    return this._kind ?? this.network?.kind;
  }
}
