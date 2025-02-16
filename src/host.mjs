import { Base } from "./base.mjs";
import { Network } from "./network.mjs";
import { Service } from "./service.mjs";
import {
  asArray,
  isIPv4Address,
  isIPv6Address,
  normalizeIPAddress,
  formatCIDR,
  hasWellKnownSubnet
} from "./utils.mjs";
import { addType } from "./types.mjs";

export class Host extends Base {
  postinstall = [];
  #services = [];
  #extends = [];
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
    return {
      name: "host",
      extends: Base,
      properties: {
        networkInterfaces: { type: "network_interface", collection: true },
        services: { type: Service, collection: true },
        os: { type: "string" },
        distribution: { type: "string" },
        deployment: { type: "string" },
        master: { type: "boolean" },
        model: { type: "string" },
        replaces: { type: "string" },
        depends: { type: "string" },
        cidrAddresses: { type: "string", collection: true, writeable: false },
        rawAddresses: { type: "string", collection: true, writeable: false },
        rawAddress: { type: "string", writeable: false }
      }
    };
  }

  static async prepareData(root, data) {
    if (data.extends) {
      data.extends = await Promise.all(
        asArray(data.extends).map(e => root.load(e, { type: Host }))
      );
    }

    return this;
  }

  constructor(owner, data) {
    super(owner, data);

    if (data.deployment !== undefined) {
      this.#deployment = data.deployment;
      delete data.deployment;
    }
    if (data.chassis !== undefined) {
      this.#chassis = data.chassis;
      delete data.chassis;
    }
    if (data.vendor !== undefined) {
      this.#vendor = data.vendor;
      delete data.vendor;
    }
    if (data.extends !== undefined) {
      this.#extends = data.extends;
      delete data.extends;
    }
    if (data.os !== undefined) {
      this.#os = data.os;
      delete data.os;
    }
    if (data.distribution !== undefined) {
      this.#distribution = data.distribution;
      delete data.distribution;
    }
    if (data.master !== undefined) {
      this.#master = data.master;
      delete data.master;
    }
    if (data.depends !== undefined) {
      this.#depends = new Set(asArray(data.depends));
      delete data.depends;
    }
    if (data.replaces !== undefined) {
      this.#replaces = new Set(asArray(data.replaces));
      delete data.replaces;
    }
    if (data.provides !== undefined) {
      this.#provides = new Set(asArray(data.provides));
      delete data.provides;
    }

    for (const host of this.extends) {
      for (const service of host.services()) {
        service.forOwner(this);
      }
    }

    this.read(data);

    Object.assign(this, data);

    owner.addObject(this);
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const ni of this.networkInterfaces.values()) {
        ni._traverse(...args);
      }
      for (const service of this.services()) {
        service._traverse(...args);
      }

      return true;
    }
    return false;
  }

  get deployment() {
    return this.#deployment || this.extends.find(e => e.deployment)?.deployment;
  }

  get chassis() {
    return this.#chassis || this.extends.find(e => e.chassis)?.chassis;
  }

  get vendor() {
    return this.#vendor || this.extends.find(e => e.vendor)?.vendor;
  }

  get isModel() {
    return this.#vendor || this.#chassis ? true : false;
  }

  get model() {
    return this.extends.find(h => h.isModel);
  }

  get extends() {
    return this.#extends.map(e => this.expand(e));
  }

  get provides() {
    let provides = new Set(this.#provides);
    this.extends.forEach(h => (provides = provides.union(h.provides)));
    return provides;
  }

  get replaces() {
    let replaces = new Set(this.#replaces);
    this.extends.forEach(h => (replaces = replaces.union(h.replaces)));
    return replaces;
  }

  get _depends() {
    let depends = this.#depends;
    this.extends.forEach(h => (depends = depends.union(h._depends)));
    return depends;
  }

  get depends() {
    return this.expand(this._depends);
  }

  get master() {
    return this.#master || this.extends.find(e => e.master) ? true : false;
  }

  get os() {
    return this.#os || this.extends.find(e => e.os);
  }

  get distribution() {
    return this.#distribution || this.extends.find(e => e.distribution);
  }

  get domain() {
    return this.location?.domain;
  }

  get modelName() {
    return this.model?.hostName;
  }

  get hostName() {
    const parts = this.name.split(/\//);
    return parts[parts.length - 1];
  }

  get domainName() {
    const domain = this.domain;
    const hostName = this.hostName;
    return domain ? hostName + "." + domain : hostName;
  }

  get host() {
    return this;
  }

  get network() {
    return this.owner.network;
  }

  addService(service) {
    this.#services.push(service);
  }

  *services(filter) {
    for (const service of this.#services) {
      if (
        !filter ||
        filter.type === "*" ||
        filter.type === service.type ||
        filter.name === service.name
      ) {
        yield service;
      }
    }
  }

  get networkInterfaces() {
    return this.#networkInterfaces;
  }

  networkInterfaceNamed(name) {
    return this.#networkInterfaces.get(name);
  }

  addNetworkInterface(networkInterface) {
    this.#networkInterfaces.set(networkInterface.name, networkInterface);

    if (networkInterface.network) {
      networkInterface.network.addObject(this);
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

  get cidrAddresses() {
    return [...this.networkAddresses()].map(({ address, subnet }) =>
      formatCIDR(address, subnet)
    );
  }

  async publicKey(type = "ed25519") {
    return readFile(join(this.directory, `ssh_host_${type}_key.pub`), "utf8");
  }

  toJSON() {
    return {
      ...super.toJSON(),
      extends: this.extends.map(host => host.name),
      networkInterfaces: Object.fromEntries(
        [...this.networkInterfaces.values()].map(ni => [ni.name, ni.toJSON()])
      ),
      services: Object.fromEntries(
        [...this.services()].map(s => [s.name, s.toJSON()])
      )
    };
  }
}

export class NetworkInterface extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return {
      name: "network_interface",
      extends: Base,
      properties: {
        hwaddr: { type: "string" },
        scope: { type: "string" },
        kind: { type: "string" },
        ssid: { type: "string" },
        psk: { type: "string" },
        metric: { type: "number" },
        MTU: { type: "number" },
        cidrAddresses: { type: "string", collection: true, writeable: false },
        rawAddresses: { type: "string", collection: true, writeable: false },
        network: { type: "network" },
        gateway: {},
        arpbridge: {}
      }
    };
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

    if (data.ssid) {
      this.#ssid = data.ssid;
      delete data.ssid;
    }
    if (data.psk) {
      this.#psk = data.psk;
      delete data.psk;
    }
    if (data.scope) {
      this.#psk = data.scope;
      delete data.scope;
    }
    if (data.metric) {
      this.#metric = data.metric;
      delete data.metric;
    }
    if (data.kind) {
      this.#kind = data.kind;
      delete data.kind;
    }

    if (data.network) {
      let network = owner.owner.networkNamed(data.network);

      if (network) {
        this.network = network;
      } else {
        network = data.network;
        this.finalize(() => (this.network = network));
      }

      delete data.network;
    } else if (owner.owner instanceof Network) {
      this.network = owner.owner;
    }

    Object.assign(this, data);

    owner.addNetworkInterface(this);

    //this.arpbridge = owner.addARPBridge(this, data.arpbridge);
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

  get rawAddresses() {
    return [...this.#ipAddresses].map(([address, subnet]) => address);
  }

  get cidrAddresses() {
    return [...this.#ipAddresses].map(([address, subnet]) =>
      formatCIDR(address, subnet)
    );
  }

  get rawIPv4Addresses() {
    return [...this.ipAddresses]
      .filter(([address, subnet]) => isIPv4Address(address))
      .map(([address, subnet]) => address);
  }

  get rawIPv6Addresses() {
    return [...this.ipAddresses]
      .filter(([address, subnet]) => isIPv6Address(address))
      .map(([address, subnet]) => address);
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

  get network() {
    return this.#network || this.host.network;
  }

  set network(networkOrName) {
    if (!(networkOrName instanceof Network)) {
      let network = this.host.owner.networkNamed(networkOrName);

      if (network) {
        this.#network = network;
        return;
      } else {
        this.error("Unknown network", networkOrName);
      }
    }

    this.#network = networkOrName;
  }

  get scope() {
    return this.#scope || this.network?.scope || "global";
  }

  get metric() {
    return this.#metric || this.network?.metric || 1004;
  }

  get ssid() {
    return this.#ssid || this.network?.ssid;
  }

  get psk() {
    return this.#psk || this.network?.psk;
  }

  get kind() {
    return this.#kind || this.network?.kind;
  }
}
