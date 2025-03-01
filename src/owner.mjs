import { asArray, normalizeCIDR } from "./utils.mjs";
import { Base } from "./base.mjs";
import { Subnet } from "./subnet.mjs";
import { addType } from "./types.mjs";
import { DNSService } from "./dns.mjs";

const OwnerTypeDefinition = {
  name: "owner",
  owners: ["owner", "root"],
  priority: 0.9,
  extends: Base.typeDefinition,
  properties: {
    networks: { type: "network", collection: true, writeable: true },
    hosts: { type: "host", collection: true, writeable: true },
    clusters: { type: "cluster", collection: true, writeable: true },
    subnets: { type: Subnet.typeDefinition, collection: true, writeable: true },
    dns: {
      type: DNSService.typeDefinition,
      collection: false,
      writeable: true
    },
    ntp: { type: "string", collection: false, writeable: true },
    country: { type: "string", collection: false, writeable: true },
    domain: { type: "string", collection: false, writeable: true },
    timezone: { type: "string", collection: false, writeable: true },
    locales: { type: "string", collection: true, writeable: true },
    administratorEmail: { type: "string", collection: false, writeable: true }
  }
};

const EMPTY = new Map();

export class Owner extends Base {
  #membersByType = new Map();
  #bridges = new Set();
  ntp;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return OwnerTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, OwnerTypeDefinition);
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const typeSlot of this.#membersByType.values()) {
        for (const object of typeSlot.values()) {
          object._traverse(...args);
        }
      }

      this.dns?._traverse(...args);

      return true;
    }

    return false;
  }

  named(name) {
    if (name[0] === "/") {
      name = name.substring(this.fullName.length + 1);
    }

    for (const slot of this.#membersByType.values()) {
      const object = slot.get(name);
      if (object) {
        return object;
      }
    }

    // TODO cascade
    const parts = name.split(/\//);

    if (parts.length >= 2) {
      const last = parts.pop();

      const next = this.named(parts.join("/"));
      if (next) {
        return next.named(last);
      }
    }
  }

  typeNamed(typeName, name) {
    if (name[0] === "/") {
      name = name.substring(this.fullName.length + 1);
    }

    const typeSlot = this.#membersByType.get(typeName);
    return typeSlot?.get(name) || this.owner?.typeNamed(typeName, name);
  }

  typeObject(typeName) {
    return this.#membersByType.get(typeName);
  }

  typeList(typeName) {
    const typeSlot = this.#membersByType.get(typeName);
    return (typeSlot || EMPTY).values();
  }

  addTypeObject(typeName, name, object) {
    let typeSlot = this.#membersByType.get(typeName);
    if (!typeSlot) {
      typeSlot = new Map();
      this.#membersByType.set(typeName, typeSlot);
    }

    typeSlot.set(name, object);
  }

  addObject(object) {
    this.addTypeObject(object.typeName, object.name, object);
  }

  findService(filter) {
    let best;
    for (const service of this.findServices(filter)) {
      if (!best || service.priority < best.priority) {
        best = service;
      }
    }

    return best;
  }

  *findServices(filter) {
    for (const host of this.hosts()) {
      for (const service of host.findServices(filter)) {
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

    const subnet = this.subnetForAddress(address);
    if (!subnet) {
      this.error(
        `Address without subnet ${address}`,
        [...this.subnets()].map(s => s.address)
      );
    }
    return subnet;
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
      yield* host.networkAddresses();
    }
  }

  #country;

  set country(value) {
    this.#country = value;
  }

  get country() {
    return this.#country || this.owner?.country;
  }

  #locales = new Set();

  set locales(value) {
    if (value instanceof Set) {
      this.#locales = this.#locales.union(value);
    } else {
      this.#locales.add(value);
    }
  }

  get locales() {
    if (this.owner) {
      return this.owner.locales.union(this.#locales);
    }
    return this.#locales;
  }

  #timezone;

  set timezone(value) {
    this.#timezone = value;
  }

  get timezone() {
    return this.#timezone || this.owner?.timezone;
  }

  #administratorEmail;

  set administratorEmail(value) {
    this.#administratorEmail = value;
  }

  get administratorEmail() {
    if (this.#administratorEmail) {
      return this.#administratorEmail;
    }

    if (this.owner && !this.#domain) {
      return this.owner.administratorEmail;
    }

    return "admin@" + this.domain;
  }

  #domain;

  set domain(value) {
    this.#domain = value;
  }

  get domain() {
    return this.#domain || this.owner?.domain;
  }

  *domains() {
    for (const location of this.locations()) {
      yield location.domain;
    }
  }
}
