import { asArray } from "./utils.mjs";
import { Base } from "./base.mjs";
import { DNSService } from "./dns.mjs";

export class Owner extends Base {
  #membersByType = new Map();
  #bridges = new Set();
  #dns;
  #administratorEmail;
  domain;
  ntp = { servers: [] };

  static get typeName() {
    return "owner";
  }

  constructor(owner, data = {}) {
    super(owner, data);

    let dns;
    if (data.dns) {
      dns = data.dns;
      delete data.dns;
    }

    this.#dns = new DNSService(this, dns);

    if (data.administratorEmail) {
      this.#administratorEmail = data.administratorEmail;
      delete data.administratorEmail;
    }

    if (data.domain) {
      this.domain = data.domain;
      delete data.domain;
    }

    if (data.ntp) {
      this.ntp = data.ntp;
      delete data.ntp;
    }

    if (data.networks) {
      const networks = data.networks;
      delete data.networks;

      for (const [name, data] of Object.entries(networks)) {
        data.name = name;
        new Network(this, data);
      }
    }

    owner?.addObject(this);
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const typeSlot of this.#membersByType.values()) {
        for (const object of typeSlot.values()) {
          object._traverse(...args);
        }
      }

      return true;
    }

    return false;
  }

  get dns() {
    return this.#dns;
  }

  named(name) {
    //console.log("NAMED", this.#membersByType.keys());
    for (const slot of this.#membersByType.values()) {
      const object = slot.get(name);
      if (object) {
        return object;
      }
    }
  }

  typeNamed(typeName, name) {
    const typeSlot = this.#membersByType.get(typeName);
    return typeSlot?.get(name);
  }

  *typeList(typeName) {
    const typeSlot = this.#membersByType.get(typeName);
    if (typeSlot) {
      for (const object of typeSlot.values()) {
        yield object;
      }
    }
  }

  _addObject(typeName, fullName, object) {
    let typeSlot = this.#membersByType.get(typeName);
    if (!typeSlot) {
      typeSlot = new Map();
      this.#membersByType.set(typeName, typeSlot);
    }
    typeSlot.set(fullName, object);
  }

  addObject(object) {
    this.owner?.addObject(object);
    this._addObject(object.typeName, object.fullName, object);
  }

  async service(filter) {
    let best;
    for await (const service of this.services(filter)) {
      if (!best || service.priority < best.priority) {
        best = service;
      }
    }

    return best;
  }

  async *services(filter) {
    for await (const host of this.hosts()) {
      for await (const service of host.services(filter)) {
        yield service;
      }
    }
  }

  locationNamed(name) {
    return this.typeNamed("location", name);
  }

  locations() {
    return this.typeList("location");
  }

  hostNamed(name) {
    return this.typeNamed("host", name);
  }

  hosts() {
    return this.typeList("host");
  }

  networkNamed(name) {
    return this.typeNamed("network", name);
  }

  networks() {
    return this.typeList("network");
  }

  subnetNamed(name) {
    return this.typeNamed("subnet", name);
  }

  subnets() {
    return this.typeList("subnet");
  }

  clusterNamed(name) {
    return this.typeNamed("cluster", name);
  }

  clusters() {
    return this.typeList("cluster");
  }

  addBridge(network, destinationNetworks) {
    if (destinationNetworks) {
      let bridge;

      for (bridge of this.#bridges) {
        if (bridge.has(network.name)) {
          bridge.delete(network.name);
          bridge.add(network);
          break;
        }

        if (bridge.has(network)) {
          break;
        }
      }

      if (!bridge) {
        bridge = new Set([network]);
        this.#bridges.add(bridge);
      }

      for (const name of asArray(destinationNetworks)) {
        const other = this.networkNamed(name);
        if (other) {
          bridge.add(other);
          other.bridge = bridge;
        } else {
          bridge.add(name);
          this.finalize(() => this._resolveBridges());
        }
      }

      return bridge;
    }
  }

  _resolveBridges() {
    for (const bridge of this.#bridges) {
      //this.info(bridgeToJSON(bridge));
      for (const network of bridge) {
        if (typeof network === "string") {
          const other = this.networkNamed(network);

          if (other) {
            bridge.delete(network);
            bridge.add(other);
            other.bridge = bridge;
          } else {
            this.error(`Unresolvabale bridge network`, network);
          }
        }
      }
    }
  }

  async *networkAddresses() {
    for await (const host of this.hosts()) {
      for (const networkAddresses of host.networkAddresses()) {
        yield networkAddresses;
      }
    }
  }

  get administratorEmail() {
    return this.#administratorEmail || "admin@" + this.domain;
  }

  *domains() {
    for (const location of this.locations()) {
      yield location.domain;
    }
  }

  get propertyNames() {
    return [...super.propertyNames, "domain", "administratorEmail", "dns"];
  }

  toJSON() {
    const json = super.toJSON();

    for (const [typeName, slot] of this.#membersByType) {
      json[typeName] = [...slot.keys()].sort();
    }

    return json;
  }
}

export class Network extends Owner {
  kind;
  scope;
  metric;
  subnet;
  bridge;
  #ipAddresses = [];

  static get typeName() {
    return "network";
  }

  constructor(owner, data) {
    super(owner, data);

    if (data.ipAddresses) {
      this.#ipAddresses.push(...asArray(data.ipAddresses));
      delete data.ipAddresses;
    }

    let bridge;
    if (data.bridge) {
      bridge = data.bridge;
      delete data.bridge;
    }

    Object.assign(this, data);

    const subnetAddress = this.subnetAddress;

    if (subnetAddress) {
      let subnet = owner.subnetNamed(subnetAddress);
      if (!subnet) {
        subnet = new Subnet(owner, { name: subnetAddress });
      }

      this.subnet = subnet;
      subnet.networks.add(this);
    }

    //owner.addObject(this);

    this.bridge = owner.addBridge(this, bridge);
  }

  networkNamed(name) {
    if (this.fullName === name) {
      return this;
    }
    return super.networkNamed(name);
  }

  set ipAddresses(value) {
    this.#ipAddresses = asArray(value);
  }

  get ipAddresses() {
    return this.#ipAddresses;
  }

  get prefixLength() {
    for (const a of this.#ipAddresses) {
      const m = a.match(/\/(\d+)$/);
      if (m) {
        return parseInt(m[1]);
      }
    }

    this.error("no prefixLength", this.#ipAddresses);
  }

  get subnetAddress() {
    for (const a of this.#ipAddresses) {
      const [addr, bits] = a.split(/\//);
      if (bits) {
        const parts = addr.split(/\./);
        return parts.slice(0, bits / 8).join(".");
      }
    }
  }

  get propertyNames() {
    return [
      ...super.propertyNames,
      "kind",
      "ipAddresses",
      "subnet",
      "prefixLength",
      "scope",
      "metric",
      "bridge"
    ];
  }
}

export class Subnet extends Base {
  networks = new Set();

  static get typeName() {
    return "subnet";
  }

  constructor(owner, data) {
    super(owner, data);

    Object.assign(this, data);

    owner.addObject(this);
  }

  get address() {
    return this.name;
  }

  get propertyNames() {
    return [...super.propertyNames, "networks"];
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const network of this.networks) {
        network._traverse(...args);
      }
      return true;
    }

    return false;
  }
}
