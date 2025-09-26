import { normalizeCIDR, familyIP } from "ip-utilties";
import {
  string_collection_attribute_writable,
  string_attribute_writable,
  email_attribute
} from "pacc";
import { asIterator } from "./utils.mjs";
import { Base } from "./base.mjs";
import { Subnet, SUBNET_GLOBAL_IPV4, SUBNET_GLOBAL_IPV6 } from "./subnet.mjs";
import { addType, types } from "./types.mjs";
import { networks_attribute } from "./network-support.mjs";

const OwnerTypeDefinition = {
  name: "owner",
  owners: ["location", "owner", "root"],
  priority: 0.9,
  extends: Base.typeDefinition,
  key: "name",
  attributes: {
    networks: networks_attribute,
    hosts: { type: "host", collection: true, writable: true },
    clusters: { type: "cluster", collection: true, writable: true },
    subnets: { type: Subnet.typeDefinition, collection: true, writable: true },
    country: string_attribute_writable,
    domain: string_attribute_writable,
    domains: string_collection_attribute_writable,
    timezone: string_attribute_writable,
    architectures: string_collection_attribute_writable,
    locales: string_collection_attribute_writable,
    administratorEmail: { ...email_attribute, writable: true }
  }
};

const EMPTY = new Map();

export class Owner extends Base {
  _membersByType = new Map();
  _bridges = new Set();

  static {
    addType(this);
  }

  static get typeDefinition() {
    return OwnerTypeDefinition;
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const typeSlot of this._membersByType.values()) {
        for (const object of typeSlot.values()) {
          object._traverse(...args);
        }
      }

      return true;
    }

    return false;
  }

  *find(pattern) {
    for (const node of this.traverse(() => {})) {
      for (const p of pattern) {
        if (node.fullName.match(p)) {
          yield node;
          break;
        }
      }
    }
  }

  named(name) {
    if (name[0] === "/") {
      name = name.substring(this.fullName.length + 1);
    }

    for (const slot of this._membersByType.values()) {
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
    const typeSlot = this._membersByType.get(typeName);
    if (typeSlot) {
      const object = typeSlot.get(
        name[0] === "/" ? name.substring(this.fullName.length + 1) : name
      );
      if (object) {
        return object;
      }
    }

    return super.typeNamed(typeName, name);
  }

  typeObject(typeName) {
    return this._membersByType.get(typeName);
  }

  typeList(typeName) {
    const typeSlot = this._membersByType.get(typeName);
    return (typeSlot || EMPTY).values();
  }

  addTypeObject(typeName, name, object) {
    let typeSlot = this._membersByType.get(typeName);
    if (!typeSlot) {
      typeSlot = new Map();
      this._membersByType.set(typeName, typeSlot);
    }

    typeSlot.set(name, object);
  }

  addObject(object) {
    this.addTypeObject(object.typeName, object.name, object);
  }

  *findServices(filter) {
    for (const host of this.hosts()) {
      yield* host.findServices(filter);
    }
  }

  locationNamed(name) {
    return this.typeNamed("location", name);
  }

  locations() {
    return this.typeList("location");
  }

  hostNamed(name) {
    return this.typeNamed("host", name) || this.typeNamed("cluster", name);
  }

  directHosts() {
    let hosts = new Set();
    for (const type of ["host", "cluster"]) {
      hosts = hosts.union(new Set(Array.from(this.typeList(type))));
    }

    return hosts;
  }

  hosts() {
    let hosts = this.directHosts();

    for (const type of types.host.owners) {
      for (const object of this.typeList(type)) {
        hosts = hosts.union(object.hosts());
      }
    }

    return hosts;
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
    const { cidr, prefixLength } = normalizeCIDR(address);

    if (cidr && prefixLength !== 0) {
      return this.subnetNamed(cidr) || new Subnet(this, cidr);
    }

    let subnet = this.subnetForAddress(address);

    if (!subnet) {
      subnet =
        familyIP(address) === "IPv4" ? SUBNET_GLOBAL_IPV4 : SUBNET_GLOBAL_IPV6;

      /*
      this.error(
        `Address without subnet ${address}`,
        [...this.subnets()].map(s => s.address)
      );
      */
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

  get bridges() {
    return this._bridges;
  }

  addBridge(network, destinationNetworks) {
    if (destinationNetworks) {
      let bridge;

      for (bridge of this._bridges) {
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
        this._bridges.add(bridge);
      }

      for (const nameOrNetwork of asIterator(destinationNetworks)) {
        const other =
          nameOrNetwork instanceof Owner
            ? nameOrNetwork
            : this.networkNamed(nameOrNetwork);
        if (other) {
          if (!bridge.has(other)) {
            bridge.add(other);
            other.bridge = bridge;
          }
        } else {
          bridge.add(nameOrNetwork);
          this.finalize(() => this._resolveBridges());
        }
      }

      return bridge;
    }
  }

  _resolveBridges() {
    for (const bridge of this._bridges) {
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

  get derivedPackaging() {
    let all = new Set();
    for (const host of this.hosts()) {
      all = all.union(host.packaging);
    }

    return all;
  }

  *networkAddresses(filter) {
    for (const host of this.hosts()) {
      yield* host.networkAddresses(filter);
    }
  }

  _country;

  set country(value) {
    this._country = value;
  }

  get country() {
    return this._country ?? this.owner?.country;
  }

  _locales = new Set();

  set locales(value) {
    if (value instanceof Set) {
      this._locales = this._locales.union(value);
    } else {
      this._locales.add(value);
    }
  }

  get locales() {
    if (this.owner) {
      return this.owner.locales.union(this._locales);
    }
    return this._locales;
  }

  _timezone;

  set timezone(value) {
    this._timezone = value;
  }

  get timezone() {
    return this._timezone ?? this.owner?.timezone;
  }

  _administratorEmail;

  set administratorEmail(value) {
    this._administratorEmail = value;
  }

  get administratorEmail() {
    if (this._administratorEmail) {
      return this._administratorEmail;
    }

    if (this.owner && !this._domain) {
      return this.owner.administratorEmail;
    }

    return "admin@" + this.domain;
  }

  _domain;

  set domain(value) {
    this._domain = value;
  }

  get domain() {
    return this._domain ?? this.owner?.domain;
  }

  get domains() {
    let domains = new Set();

    for (const object of this.hosts()) {
      domains = domains.union(object.domains);
    }

    return domains;
  }

  get localDomains() {
    return this.domain ? new Set([this.domain]) : new Set();
  }

  get domainNames() {
    let names = new Set();

    for (const host of this.hosts()) {
      names = names.union(new Set(host.domainNames));
    }

    return names;
  }

  _architectures;

  set architectures(value) {
    if (value instanceof Set) {
      this._architectures = this._architectures
        ? this._architectures.union(value)
        : value;
    } else {
      this._architectures = new Set(value);
    }
  }

  get architectures() {
    if (this._architectures) {
      return this._architectures;
    }

    const architectures = new Set();

    for (const host of this.hosts()) {
      architectures.add(host.architecture);
    }

    return architectures;
  }
}
