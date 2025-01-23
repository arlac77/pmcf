import { readFile, glob } from "node:fs/promises";
import { join } from "node:path";
import { getAttribute } from "pacc";
import { asArray, bridgeToJSON } from "./utils.mjs";

export class Base {
  owner;
  name;
  description;

  static get typeName() {
    return "base";
  }

  static get typeFileName() {
    return this.typeName + ".json";
  }

  static get fileNameGlob() {
    return "**/" + this.typeFileName;
  }

  static async prepareData(world, data) {
    return this;
  }

  static baseName(name) {
    if (!name) {
      return undefined;
    }

    return name.replace(/\/\w+\.json$/, "");
  }

  constructor(owner, data) {
    this.owner = owner;

    if (data) {
      this.name = data.name;
      if (data.description) {
        this.description = data.description;
      }
    }
  }

  withOwner(owner) {
    if (this.owner !== owner) {
      return new this.constructor(owner, this);
    }

    return this;
  }

  get typeName() {
    return this.constructor.typeName;
  }

  get world() {
    return this.owner.world;
  }

  get location() {
    if (this instanceof Location) {
      return this;
    }
    return this.owner.location;
  }

  get host() {
    if (this instanceof Host) {
      return this;
    }
    return this.owner.host;
  }

  async network(name) {
    return this.owner.network(name);
  }

  #directory;
  set directory(directory) {
    this.#directory = directory;
  }

  get directory() {
    return this.#directory || join(this.owner.directory, this.name);
  }

  get fullName() {
    return this.owner ? join(this.owner.fullName, this.name) : this.name;
  }

  expand(object) {
    switch (typeof object) {
      case "string":
        return object.replaceAll(/\$\{([^\}]*)\}/g, (match, m1) => {
          return getAttribute(this, m1) || "${" + m1 + "}";
        });

      case "object":
        if (Array.isArray(object)) {
          return object.map(e => this.expand(e));
        }

        if (object instanceof Set) {
          return new Set([...object].map(e => this.expand(e)));
        }

      /*return Object.fromEntries(
          Object.entries(object).map(([k, v]) => [k, this.expand(v)])
        );*/
    }

    return object;
  }

  error(...args) {
    console.error(`${this.toString()}:`, ...args);
  }

  info(...args) {
    console.info(`${this.toString()}:`, ...args);
  }

  toString() {
    return `${this.fullName}(${this.typeName})`;
  }

  get propertyNames() {
    return ["name", "description", "directory", "owner"];
  }

  toJSON() {
    return extractFrom(this, this.propertyNames);
  }
}

export class Owner extends Base {
  #hosts = new Map();
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

  network(name) {
    return this.#networks.get(name);
  }

  async *networks() {
    for (const network of this.#networks.values()) {
      yield network;
    }
  }

  addNetwork(network) {
    this.#networks.set(network.name, network);
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
        const other = this.network(name);
        if (other) {
          bridge.add(other);
          other.bridge = bridge;
        } else {
          bridge.add(name);
          this.resolveLater(() => this._resolveBridges());
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
          const other = this.network(network);

          if (other) {
            bridge.delete(network);
            bridge.add(other);
            other.bridge = bridge;
            this.info("RESOLVE", network, other, bridgeToJSON(bridge));
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

  #resolveActions = [];

  resolveLater(action) {
    this.#resolveActions.push(action);
  }

  resolve() {
    for (const action of this.#resolveActions) {
      action();
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

export class World extends Owner {
  static get types() {
    return _typesByName;
  }

  static get typeName() {
    return "world";
  }

  #byName = new Map();

  constructor(directory) {
    super(undefined, { name: "" });
    this.directory = directory;
    this.addObject(this);
  }

  get fullName() {
    return "";
  }

  get world() {
    return this;
  }

  async load(name, options) {
    if (name === "") {
      return this;
    }
    const baseName = Base.baseName(name);

    let object = this.#byName.get(baseName);

    if (!object) {
      let path = baseName.split("/");
      path.pop();

      let data;
      let type = options?.type;
      if (type) {
        data = JSON.parse(
          await readFile(
            join(this.directory, baseName, type.typeFileName),
            "utf8"
          )
        );
      } else {
        for (type of _types) {
          try {
            data = JSON.parse(
              await readFile(
                join(this.directory, baseName, type.typeFileName),
                "utf8"
              )
            );
            break;
          } catch {}
        }

        if (!data) {
          return this.load(path.join("/"), options);
        }
      }

      const owner = await this.load(path.join("/"));

      const length = owner.fullName.length;
      const n = baseName[length] === "/" ? length + 1 : length;
      data.name = baseName.substring(n);

      type = await type.prepareData(this, data);

      object = new type(owner, data);
      this.addObject(object);
    }

    return object;
  }

  async loadAll() {
    for (let type of Object.values(World.types)) {
      for await (const name of glob(type.fileNameGlob, {
        cwd: this.directory
      })) {
        await this.load(name, { type });
      }
    }
  }

  addObject(object) {
    this.#byName.set(object.fullName, object);
  }

  async named(name) {
    await this.loadAll();
    return this.#byName.get(name);
  }

  async *locations() {
    await this.loadAll();

    for (const object of this.#byName.values()) {
      if (object instanceof Location) {
        yield object;
      }
    }
  }

  async *hosts() {
    await this.loadAll();

    for (const object of this.#byName.values()) {
      if (object instanceof Host) {
        yield object;
      }
    }
  }

  async *domains() {
    for await (const location of this.locations()) {
      yield location.domain;
    }
  }

  async location(name) {
    return this.load(name, { type: Location });
  }

  async host(name) {
    return this.load(name, { type: Host });
  }
}

class DNSService extends Base {
  allowedUpdates = [];
  recordTTL = "1W";
  forwardsTo = [];

  static get typeName() {
    return "dns";
  }

  constructor(owner, data) {
    super(owner, data);
    Object.assign(this, data);
  }

  async *services() {
    const filter = { type: "dns" };

    yield* this.owner.services(filter);

    for (const s of asArray(this.forwardsTo)) {
      const owner = await this.owner.world.load(s);
      yield* owner.services(filter);
    }
  }

  get propertyNames() {
    return ["recordTTL", "forwardsTo", "allowedUpdates"];
  }
}

export class Location extends Owner {
  static get typeName() {
    return "location";
  }

  async *hosts() {
    for await (const host of this.owner.hosts()) {
      if (host.location === this) {
        yield host;
      }
    }
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

  get ipv4_netmask() {
    const m = this.ipv4?.match(/\/(\d+)$/);
    if (m) {
      return m[1];
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
      "scope",
      "metric",
      "bridge"
    ];
  }
}

export class Host extends Base {
  networkInterfaces = {};
  postinstall = [];
  #services = [];
  #extends = [];
  #provides = new Set();
  #replaces = new Set();
  #depends = new Set();
  #master = false;
  #os;
  #distribution;
  #deployment;
  #chassis;
  #vendor;
  #location;

  static get typeName() {
    return "host";
  }

  static async prepareData(world, data) {
    if (data.location) {
      data.location = await world.location(data.location);
    }

    if (data.extends) {
      data.extends = await Promise.all(
        asArray(data.extends).map(e => world.host(e))
      );
    }

    return this;
  }

  constructor(owner, data) {
    super(owner, data);

    if (data.location !== undefined) {
      this.#location = data.location;
      delete data.location;
    }

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

    if (data.services) {
      for (const [name, sd] of Object.entries(data.services)) {
        sd.name = name;
        new Service(this, sd);
      }
      delete data.services;
    }

    for (const host of this.extends) {
      for (const service of host.services()) {
        service.withOwner(this);
      }
    }

    Object.assign(this, { networkInterfaces: {} }, data);

    owner.addHost(this);

    for (const [name, iface] of Object.entries(this.networkInterfaces)) {
      iface.name = name;
      this.networkInterfaces[name] = new NetworkInterface(this, iface);
    }
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

  get location() {
    return this.#location || super.location;
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
    return this.hostName + "." + this.domain;
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

  *networkAddresses() {
    for (const [name, networkInterface] of Object.entries(
      this.networkInterfaces
    )) {
      for (const attribute of ["ipv4", "ipv6", "link-local-ipv6"]) {
        if (networkInterface[attribute]) {
          yield { address: networkInterface[attribute], networkInterface };
        }
      }
    }
  }

  get ipAddresses() {
    return [...this.networkAddresses()].map(na => na.address);
  }

  get ipAddress() {
    for (const a of this.networkAddresses()) {
      return a.address;
    }
  }

  async publicKey(type = "ed25519") {
    return readFile(join(this.directory, `ssh_host_${type}_key.pub`), "utf8");
  }

  get propertyNames() {
    return [
      ...super.propertyNames,
      "os",
      "distribution",
      "deployment",
      "master",
      "location",
      "model",
      "replaces",
      "depends",
      "networkInterfaces"
    ];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      extends: this.extends.map(host => host.name),
      services: Object.fromEntries(
        [...this.services()].map(s => [s.name, s.toJSON()])
      )
    };
  }
}

export class NetworkInterface extends Base {
  static get typeName() {
    return "network_interface";
  }

  constructor(owner, data) {
    super(owner, data);

    if (data.network) {
      const network = owner.owner.network(data.network);

      if (network) {
        data.network = network;
        network.addHost(owner);
      } else {
        this.error("Missing network", data.network);
      }
    }

    Object.assign(this, data);
  }

  get host() {
    return this.owner;
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

const ServiceTypes = {
  dns: { protocol: "udp", port: 53 },
  ldap: { protocol: "tcp", port: 389 },
  http: { protocol: "tcp", port: 80 },
  https: { protocol: "tcp", port: 443 },
  rtsp: { protocol: "tcp", port: 554 },
  smtp: { protocol: "tcp", port: 25 },
  ssh: { protocol: "tcp", port: 22 },
  imap: { protocol: "tcp", port: 143 },
  imaps: { protocol: "tcp", port: 993 },
  dhcp: {}
};

export class Service extends Base {
  alias;
  #weight;
  #priority;
  #type;
  #port;
  #ipAddresses;

  static get typeName() {
    return "service";
  }

  constructor(owner, data) {
    super(owner, data);
    if (data.weight !== undefined) {
      this.#weight = data.weight;
      delete data.weight;
    }
    if (data.priority !== undefined) {
      this.#priority = data.priority;
      delete data.priority;
    }
    if (data.type) {
      this.#type = data.type;
      delete data.type;
    }
    if (data.port !== undefined) {
      this.#port = data.port;
      delete data.port;
    }
    if (data.ipAddresses) {
      this.#ipAddresses = data.ipAddresses;
      delete data.ipAddresses;
    }

    Object.assign(this, data);

    this.owner = owner;

    owner.addService(this);
  }

  withOwner(owner) {
    if (this.owner !== owner) {
      const data = { name: this.name };
      if (this.alias) {
        data.alias = this.alias;
      }
      if (this.#type) {
        data.type = this.#type;
      }
      if (this.#weight) {
        data.weight = this.#weight;
      }
      if (this.#port) {
        data.port = this.#port;
      }
      if (this.#ipAddresses) {
        data.ipAddresses = this.#ipAddresses;
      }
      return new this.constructor(owner, data);
    }

    return this;
  }

  get protocol() {
    return ServiceTypes[this.type]?.protocol;
  }

  get srvPrefix() {
    const st = ServiceTypes[this.type];
    if (st) {
      return `_${this.type}._${st.protocol}`;
    }
  }

  get ipAddresses() {
    return this.#ipAddresses || this.owner.ipAddresses;
  }

  get port() {
    return this.#port || ServiceTypes[this.type]?.port;
  }

  get priority() {
    return /*this.#priority || */ this.owner.priority || 99;
  }

  get weight() {
    return this.#weight || this.owner.weight || 0;
  }

  get master() {
    return this.owner.master;
  }

  get type() {
    return this.#type || this.name;
  }

  get propertyNames() {
    return [
      ...super.propertyNames,
      "ipAddresses",
      "port",
      "protocol",
      "alias",
      "type",
      "master",
      "priority",
      "weight"
    ];
  }
}

const _types = [Location, Network, Subnet, Host, Service, DNSService];
const _typesByName = Object.fromEntries(_types.map(t => [t.typeName, t]));

export function extractFrom(object, propertyNames) {
  const json = {};
  for (const p of propertyNames) {
    const value = object[p];

    if (value !== undefined) {
      if (value instanceof Base && value.name) {
        json[p] = { name: value.name };
      } else {
        json[p] = value;
      }
    }
  }
  return json;
}
