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
    os: { type: "string", collection: false, writeable: true },
    "machine-id": { type: "string", collection: false, writeable: true },
    distribution: { type: "string", collection: false, writeable: true },
    deployment: { type: "string", collection: false, writeable: true },
    master: { type: "boolean", collection: false, writeable: true },
    serial: { type: "string", collection: false, writeable: true },
    vendor: { type: "string", collection: false, writeable: true },
    chassis: { type: "string", collection: false, writeable: true },
    priority: { type: "number", collection: false, writeable: true },
    replaces: { type: "string", collection: true, writeable: true },
    depends: { type: "string", collection: true, writeable: true },
    provides: { type: "string", collection: true, writeable: true },
    extends: { type: "host", collection: true, writeable: true },
    model: { type: "string", collection: false, writeable: false },
    isModel: { type: "boolean", collection: false, writeable: false }
  }
};

export class Host extends Base {
  serial;
  priority = 1;
  #services = [];
  #extends = [];
  #aliases = new Set();
  #networkInterfaces = new Map();
  #provides = new Set();
  #replaces = new Set();
  #depends = new Set();
  #master = false;
  #os;
  #distribution;
  #deployment;
  #chassis;
  #vendor;

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
          this.depends = host.depends;
          this.provides = host.provides;
          this.replaces = host.replaces;

          for (const service of host.services) {
            this.services = service.forOwner(this);
          }
        }

        if (!this.isTemplate) {
          this.#depends = this.expand(this.depends);
          this.#provides = this.expand(this.provides);
          this.#replaces = this.expand(this.replaces);
        }
      });
    }
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const ni of this.networkInterfaces.values()) {
        ni._traverse(...args);
      }
      for (const service of this.#services) {
        service._traverse(...args);
      }

      return true;
    }
    return false;
  }

  set deployment(value) {
    this.#deployment = value;
  }

  get deployment() {
    return this.#deployment || this.extends.find(e => e.deployment)?.deployment;
  }

  set chassis(value) {
    this.#chassis = value;
  }

  get chassis() {
    return this.#chassis || this.extends.find(e => e.chassis)?.chassis;
  }

  set vendor(value) {
    this.#vendor = value;
  }

  get vendor() {
    return this.#vendor || this.extends.find(e => e.vendor)?.vendor;
  }

  get derivedPackaging() {
    return this.extends.reduce((a, c) => a.union(c.packaging), new Set());
  }

  get isTemplate() {
    return this.isModel || this.name.match(/services\//); // TODO
  }

  get isModel() {
    return this.#vendor || this.#chassis ? true : false;
  }

  get model() {
    return this.extends.find(h => h.isModel);
  }

  set aliases(value) {
    if (value instanceof Set) {
      this.#aliases = this.#aliases.union(value);
    } else {
      this.#aliases.add(value);
    }
  }

  get aliases() {
    return this.#aliases;
  }

  set extends(value) {
    this.#extends.push(value);
  }

  get extends() {
    return this.#extends;
  }

  set provides(value) {
    if (value instanceof Set) {
      this.#provides = this.#provides.union(value);
    } else {
      this.#provides.add(value);
    }
  }

  get provides() {
    return this.#provides;
  }

  set replaces(value) {
    if (value instanceof Set) {
      this.#replaces = this.#replaces.union(value);
    } else {
      this.#replaces.add(value);
    }
  }

  get replaces() {
    return this.#replaces;
  }

  set depends(value) {
    if (value instanceof Set) {
      this.#depends = this.#depends.union(value);
    } else {
      this.#depends.add(value);
    }
  }

  get depends() {
    return this.#depends;
  }

  set master(value) {
    this.#master = value;
  }

  get master() {
    return this.#master || this.extends.find(e => e.master) ? true : false;
  }

  set os(value) {
    this.#os = value;
  }

  get os() {
    return this.#os || this.extends.find(e => e.os);
  }

  set distribution(value) {
    this.#distribution = value;
  }

  get distribution() {
    return this.#distribution || this.extends.find(e => e.distribution);
  }

  get modelName() {
    return this.model?.hostName;
  }

  get hostName() {
    const parts = this.name.split(/\//);
    return parts[parts.length - 1];
  }

  get domains() {
    return new Set(
      [...this.aliases].map(n => domainFromDominName(n, this.domain))
    ).union(this.localDomains);
  }

  get domainNames() {
    return [this.hostName, ...this.aliases].map(n =>
      domainName(n, this.domain)
    );
  }

  get domainName() {
    return domainName(this.hostName, this.domain);
  }

  domainNameIn(domain) {
    for (const domainName of this.domainNames) {
      if (domain == domainFromDominName(domainName)) {
        return domainName;
      }
    }
  }

  get host() {
    return this;
  }

  get services() {
    return this.#services;
  }

  set services(service) {
    const present = this.#services.find(s => s.name === service.name);

    if (!present) {
      this.#services.push(service);
    }
  }

  *findServices(filter) {
    yield* objectFilter(types.service, this.#services, filter);
  }

  typeNamed(typeName, name) {
    if (typeName === NetworkInterfaceTypeDefinition.name) {
      const ni = this.#networkInterfaces.get(name);
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
    const ni = this.#networkInterfaces.get(name);
    if (ni) {
      return ni;
    }
    const service = this.services.find(s => s.name === name);
    if (service) {
      return service;
    }
  }

  get networkInterfaces() {
    return this.#networkInterfaces;
  }

  set networkInterfaces(networkInterface) {
    this.#networkInterfaces.set(networkInterface.name, networkInterface);

    if (!this.isTemplate) {
      networkInterface.network?.addObject(this);
    }
  }

  *networkAddresses() {
    for (const networkInterface of this.networkInterfaces.values()) {
      for (const [address, subnet] of networkInterface.ipAddresses) {
        yield {
          networkInterface,
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

  async *preparePackages(stagingDir) {
    await this.loadPackageHooks(
      new URL("host.install", import.meta.url).pathname
    );

    for await (const result of super.preparePackages(stagingDir)) {
      await generateNetworkDefs(this, stagingDir);
      await generateMachineInfo(this, stagingDir);
      await copySshKeys(this, stagingDir);
      await generateKnownHosts(
        this.owner.hosts(),
        join(stagingDir, "root", ".ssh")
      );

      result.properties.name = `${this.typeName}-${this.owner.name}-${this.name}`;
      result.properties.dependencies = [
        `${this.location.typeName}-${this.location.name}`,
        ...this.depends
      ];
      result.properties.provides = [...this.provides];
      result.properties.replaces = [`mf-${this.hostName}`, ...this.replaces];
      result.properties.backup = "root/.ssh/known_hosts";
      result.properties.hooks = this.packageHooks;

      result.sources.push(
        new FileContentProvider(stagingDir + "/")[Symbol.asyncIterator]()
      );

      yield result;
    }
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

  #ipAddresses = new Map();
  #scope;
  #metric;
  #ssid;
  #psk;
  #network;
  #kind;
  arpbridge;
  hwaddr;

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NetworkInterfaceTypeDefinition);
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
    return this.#ipAddresses;
  }

  set ipAddresses(value) {
    for (const address of asArray(value)) {
      this.#ipAddresses.set(
        normalizeIPAddress(address),
        this.addSubnet(address)
      );
    }
  }

  get rawAddress() {
    return this.rawAddresses[0];
  }

  get rawAddresses() {
    return [...this.#ipAddresses].map(([address]) => address);
  }

  get cidrAddress() {
    return this.cidrAddresses[0];
  }

  get cidrAddresses() {
    return [...this.#ipAddresses].map(([address, subnet]) =>
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

  get host() {
    return this.owner;
  }

  get network_interface() {
    return this;
  }

  get network() {
    return this.#network || this.host.network;
  }

  set network(network) {
    this.#network = network;
  }

  set scope(value) {
    this.#scope = value;
  }

  get scope() {
    return this.#scope || this.network?.scope || "global";
  }

  set metric(value) {
    this.#metric = value;
  }

  get metric() {
    return this.#metric || this.network?.metric || 1004;
  }

  set ssid(value) {
    this.#ssid = value;
  }

  get ssid() {
    return this.#ssid || this.network?.ssid;
  }

  set psk(value) {
    this.#psk = value;
  }

  get psk() {
    return this.#psk || this.network?.psk;
  }

  set kind(value) {
    this.#kind = value;
  }

  get kind() {
    return this.#kind || this.network?.kind;
  }
}
