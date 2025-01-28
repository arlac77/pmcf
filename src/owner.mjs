import { asArray, bridgeToJSON } from "./utils.mjs";

import { Base } from "./base.mjs";
import { DNSService } from "./dns.mjs";

export class Owner extends Base {
  #hosts = new Map();
  #clusters = new Map();
  #networks = new Map();
  #subnets = new Map();
  #bridges = new Set();
  #dns;
  #administratorEmail;
  domain;
  ntp = { servers: [] };

  constructor(owner, data) {
    super(owner, data);

    let dns;
    if (data?.dns) {
      dns = data.dns;
      delete data.dns;
    }

    this.#dns = new DNSService(this, dns);

    if (data?.networks) {
      const networks = data.networks;
      delete data.networks;

      for (const [name, data] of Object.entries(networks)) {
        data.name = name;
        new Network(this, data);
      }
    }
    Object.assign(this, data);
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const network of this.#networks.values()) {
        network._traverse(...args);
      }

      for (const host of this.#hosts.values()) {
        host._traverse(...args);
      }

      for (const cluster of this.#clusters.values()) {
        cluster._traverse(...args);
      }

      return true;
    }

    return false;
  }

  get dns() {
    return this.#dns;
  }

  async *hosts() {
    for (const host of this.#hosts.values()) {
      yield host;
    }
  }

  addObject(object) {
    this.world.addObject(object);
  }

  addHost(host) {
    this.#hosts.set(host.name, host);
    this.addObject(host);
  }

  addCluster(cluster) {
    this.#clusters.set(cluster.name, cluster);
    this.addObject(cluster);
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

  networkNamed(name) {
    //console.log(this.toString(), name, this.#networks.keys());
    return this.#networks.get(name);
  }

  async *networks() {
    for (const network of this.#networks.values()) {
      yield network;
    }
  }

  addNetwork(network) {
    this.#networks.set(network.fullName, network);
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
      this.info(bridgeToJSON(bridge));
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

  addSubnet(subnet) {
    this.#subnets.set(subnet.name, subnet);
  }

  subnet(name) {
    return this.#subnets.get(name);
  }

  subnets() {
    return this.#subnets.values();
  }

  get administratorEmail() {
    return this.#administratorEmail || "admin@" + this.domain;
  }

  get propertyNames() {
    return [...super.propertyNames, "domain", "administratorEmail", "dns"];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      networks: [...this.#networks.keys()].sort(),
      subnets: [...this.#subnets.keys()].sort(),
      bridges: [...this.#bridges].map(b => bridgeToJSON(b)),
      hosts: [...this.#hosts.keys()].sort()
    };
  }
}

export class Network extends Owner {
  kind;
  scope;
  metric;
  ipv4;
  subnet;
  bridge;

  static get typeName() {
    return "network";
  }

  constructor(owner, data) {
    super(owner, data);

    let bridge;
    if (data.bridge) {
      bridge = data.bridge;
      delete data.bridge;
    }

    Object.assign(this, data);

    const subnetAddress = this.subnetAddress;

    if (subnetAddress) {
      let subnet = owner.subnet(subnetAddress);
      if (!subnet) {
        subnet = new Subnet(owner, { name: subnetAddress });
      }

      this.subnet = subnet;
      subnet.networks.add(this);
    }

    owner.addNetwork(this);

    this.bridge = owner.addBridge(this, bridge);
  }

  get netmask() {
    const m = this.ipv4?.match(/\/(\d+)$/);
    if (m) {
      return parseInt(m[1]);
    }
  }

  get subnetAddress() {
    if (this.ipv4) {
      const [addr, bits] = this.ipv4.split(/\//);
      const parts = addr.split(/\./);
      return parts.slice(0, bits / 8).join(".");
    }
  }

  get propertyNames() {
    return [
      ...super.propertyNames,
      "kind",
      "ipv4",
      "netmask",
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

    owner.addSubnet(this);
  }

  get address() {
    return this.name;
  }
}
