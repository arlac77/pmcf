import { asArray, normalizeCIDR } from "./utils.mjs";
import { Base } from "./base.mjs";
import { Subnet } from "./subnet.mjs";
import { addType } from "./types.mjs";

export class Owner extends Base {
  #membersByType = new Map();
  #bridges = new Set();
  #administratorEmail;
  domain;
  ntp = { servers: [] };

  static {
    addType(this);
  }

  static get typeName() {
    return "owner";
  }

  static get typeDefinition() {
    return {
      networks: { type: "network", collection: true },
      hosts: { type: "host", collection: true },
      clusters: { type: "cluster", collection: true },
      subnets: { type: "subnet", collection: true },
      dns: { type: "dns", collection: false }
    };
  }

  constructor(owner, data = {}) {
    super(owner, data);

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

    this.read(data);

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

  named(name) {
    for (const slot of this.#membersByType.values()) {
      const object = slot.get(name);
      if (object) {
        return object;
      }
    }
  }

  typeNamed(typeName, name) {
    const typeSlot = this.#membersByType.get(typeName);
    return typeSlot?.get(name) || this.owner?.typeNamed(typeName, name);
  }

  typeObject(typeName) {
    return this.#membersByType.get(typeName);
  }

  typeList(typeName) {
    const typeSlot = this.#membersByType.get(typeName);
    if (typeSlot) {
      return typeSlot.values();
    }

    return [];
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
    this._addObject(object.typeName, object.fullName, object);
  }

  service(filter) {
    let best;
    for (const service of this.services(filter)) {
      if (!best || service.priority < best.priority) {
        best = service;
      }
    }

    return best;
  }

  *services(filter) {
    for (const host of this.hosts()) {
      for (const service of host.services(filter)) {
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

  *subnets() {
    if (this.owner) {
      yield* this.owner.subnets();
    }
    yield* this.typeList("subnet");
  }

  addSubnet(address) {
    const { cidr } = normalizeCIDR(address);

    if (cidr) {
      return this.subnetNamed(cidr) || new Subnet(this, cidr);
    }
  }

  subnetForAddress(address) {
    for (const subnet of this.subnets()) {
      if (subnet.matchesAddress(address)) {
        return subnet;
      }
    }
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

      const subnets = new Map();

      for (let network of bridge) {
        if (typeof network === "string") {
          const other = this.networkNamed(network);

          if (other) {
            bridge.delete(network);
            bridge.add(other);
            other.bridge = bridge;
            network = other;
          } else {
            this.error(`Unresolvabale bridge network`, network);
          }
        }

        // enshure only one subnet address in the bridge
        for (const subnet of network.subnets()) {
          const present = subnets.get(subnet.address);
          if (present) {
            subnet.owner.addObject(present);

            for (const n of subnet.networks) {
              present.networks.add(n);
            }
          } else {
            subnets.set(subnet.address, subnet);
          }
        }
      }
    }
  }

  *networkAddresses() {
    for (const host of this.hosts()) {
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
