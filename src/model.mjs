import { readFile, writeFile, mkdir, glob } from "node:fs/promises";
import { join } from "node:path";

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

    if (name.endsWith("/" + this.typeFileName)) {
      return name.substring(0, name.length - this.typeFileName.length - 1);
    }

    return name;
  }

  constructor(owner, data) {
    this.owner = owner;

    if (data) {
      if (data.name) {
        this.name = data.name;
      }
      if (data.description) {
        this.description = data.description;
      }
    }
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

  network(name) {
    return this.owner.network(name);
  }

  #directory;
  set directory(directory) {
    this.#directory = directory;
  }

  get directory() {
    return this.#directory || this.name;
  }

  expand(object) {
    if (typeof object === "string") {
      return object.replaceAll(/\$\{([^\}]*)\}/g, (match, m1) => {
        return this[m1] || "${" + m1 + "}";
      });
    }

    if (Array.isArray(object)) {
      return object.map(e => this.expand(e));
    }

    if (object instanceof Set) {
      return new Set([...object].map(e => this.expand(e)));
    }

    return object;
  }

  toString() {
    return this.typeName + ":" + this.owner.name + "/" + this.name;
  }

  get propertyNames() {
    return ["name", "description", "directory", "owner"];
  }

  toJSON() {
    return extractFrom(this, this.propertyNames);
  }
}

export class World {
  static get types() {
    return _types;
  }

  directory;
  #byName = new Map();

  constructor(directory) {
    this.directory = directory;
  }

  get name() {
    return "";
  }

  get world() {
    return this;
  }

  async _loadType(name, type) {
    const baseName = type.baseName(name);

    let object = this.#byName.get(baseName);

    if (!object) {
      const data = JSON.parse(
        await readFile(
          join(this.directory, baseName, type.typeFileName),
          "utf8"
        )
      );

      let owner;
      let path = baseName.split("/");

      if (path.length > 1 && path[0] !== "model" && path[0] != "services") {
        // TODO
        path.length -= 1;
        owner = await this._loadType(path.join("/"), Location);
      } else {
        owner = this;
      }

      data.name = baseName;

      type = await type.prepareData(this, data);
      object = new type(owner, data);
      this.#byName.set(data.name, object);
    }

    return object;
  }

  async load() {
    for (let type of Object.values(World.types)) {
      for await (const name of glob(type.fileNameGlob, {
        cwd: this.directory
      })) {
        await this._loadType(name, type);
      }
    }
  }

  async named(name) {
    await this.load();
    return this.#byName.get(name);
  }

  async *locations() {
    await this.load();

    for (const object of this.#byName.values()) {
      if (object instanceof Location) {
        yield object;
      }
    }
  }

  async *hosts() {
    await this.load();

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
    return this._loadType(name, Location);
  }

  async host(name) {
    return this._loadType(name, Host);
  }

  addHost(host) {}
  network(name) {}

  async *subnets() {
    for await (const location of this.locations()) {
      yield* location.subnets();
    }
  }

  async *networkAddresses() {
    for await (const host of this.hosts()) {
      for (const networkAddresses of host.networkAddresses()) {
        yield networkAddresses;
      }
    }
  }
}

export class Host extends Base {
  networkInterfaces = {};
  services = {};
  postinstall = [];
  #extends = [];
  #provides = new Set();
  #replaces = new Set();
  #depends = new Set();
  #master = false;
  #os;
  #distribution;
  #deployment;
  #location;

  static get typeName() {
    return "host";
  }

  static async prepareData(world, data) {
    if (data.location) {
      data.location = await world.location(data.location);
    }

    if (data.extends) {
      data.extends = await Promise.all(data.extends.map(e => world.host(e)));
    }

    if (data.name?.indexOf("model/") >= 0) {
      return Model;
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
      this.#depends = new Set(data.depends);
      delete data.depends;
    }
    if (data.replaces !== undefined) {
      this.#replaces = new Set(data.replaces);
      delete data.replaces;
    }
    if (data.provides !== undefined) {
      this.#provides = new Set(data.provides);
      delete data.provides;
    }

    Object.assign(this, { services: {}, networkInterfaces: {} }, data);

    owner.addHost(this);

    for (const [name, iface] of Object.entries(this.networkInterfaces)) {
      iface.host = this;
      iface.name = name;
      if (iface.network) {
        iface.network = this.network(iface.network);
      }
    }

    for (const [name, data] of Object.entries(
      Object.assign({}, ...this.extends.map(e => e.services), this.services)
    )) {
      data.name = name;
      this.services[name] = new Service(this, data);
    }
  }

  get deployment() {
    return this.#deployment || this.extends.find(e => e.deployment);
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

  get model() {
    return this.extends.find(h => h instanceof Model);
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
        Object.values(this.services).map(s => [s.name, s.toJSON()])
      )
    };
  }
}

export class Model extends Host {}

export class Location extends Base {
  domain;
  dns;
  #administratorEmail;
  #hosts = new Map();
  #networks = new Map();
  #subnets = new Map();

  static get typeName() {
    return "location";
  }

  constructor(owner, data) {
    super(owner, data);

    const networks = data.networks;
    delete data.networks;
    Object.assign(this, data);

    if (networks) {
      for (const [name, network] of Object.entries(networks)) {
        network.name = name;
        this.addNetwork(network);
      }

      for (const network of this.#networks.values()) {
        if (network.bridges) {
          network.bridges = new Set(
            network.bridges.map(b => {
              const n = this.network(b);
              if (!n) {
                console.error(`No network named ${b}`);
              }
              return n;
            })
          );
        }
      }
    }
  }

  async load() {
    for await (const host of this.owner.hosts());
  }

  async *hosts() {
    for await (const host of this.owner.hosts()) {
      if (host.location === this) {
        yield host;
      }
    }
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
      for (const service of Object.values(host.services)) {
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
  }

  network(name) {
    return this.#networks.get(name);
  }

  async *networkAddresses() {
    await this.load();
    for await (const host of this.hosts()) {
      for (const networkAddresses of host.networkAddresses()) {
        yield networkAddresses;
      }
    }
  }

  async *networks() {
    await this.load();
    for (const network of this.#networks.values()) {
      yield network;
    }
  }

  async *subnets() {
    await this.load();
    for (const subnet of this.#subnets.values()) {
      yield subnet;
    }
  }

  addNetwork(data) {
    if (!data?.name) {
      return undefined;
    }

    let network = this.#networks.get(data.name);
    if (network) {
      return network;
    }

    network = new Network(this, data);
    this.#networks.set(data.name, network);

    const subnetAddress = network.subnetAddress;

    if (subnetAddress) {
      let subnet = this.#subnets.get(subnetAddress);
      if (!subnet) {
        subnet = new Subnet(this, subnetAddress);
        this.#subnets.set(subnetAddress, subnet);
      }
      network.subnet = subnet;
      subnet.networks.add(network);
    }
    return network;
  }

  addHost(host) {
    this.#hosts.set(host.name, host);

    for (const [name, iface] of Object.entries(host.networkInterfaces)) {
      const network = this.addNetwork({ name: iface.network });
      if (!network) {
        console.error("Missing network", host.name, name);
      } else {
        network.addHost(host);
      }
    }
  }

  get dnsAllowedUpdates() {
    return this.dns?.allowedUpdates || [];
  }

  get dnsRecordTTL() {
    return this.dns?.recordTTL || "1W";
  }

  get administratorEmail() {
    return this.#administratorEmail || "admin@" + this.domain;
  }

  get propertyNames() {
    return [...super.propertyNames, "domain"];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      hosts: [...this.#hosts.keys()].sort()
    };
  }
}

export class Network extends Base {
  #hosts = new Map();
  kind;
  scope;
  metric;
  ipv4;
  ipv4_netmask;
  subnet;

  static get typeName() {
    return "network";
  }

  constructor(owner, data) {
    super(owner, data);

    Object.assign(this, data);

    if (this.ipv4) {
      const m = this.ipv4.match(/\/(\d+)$/);
      if (m) {
        this.ipv4_netmask = m[1];
      }
    }
  }

  get subnetAddress() {
    if (this.ipv4) {
      const [addr, bits] = this.ipv4.split(/\//);
      const parts = addr.split(/\./);
      return parts.slice(0, bits / 8).join(".");
    }
  }

  async *hosts() {
    for (const host of this.#hosts.values()) {
      yield host;
    }
  }

  addHost(host) {
    this.#hosts.set(host.name, host);
  }

  get propertyNames() {
    return [...super.propertyNames, "kind", "ipv4", "scope", "metric"];
  }
}

export class Subnet extends Base {
  networks = new Set();

  static get typeName() {
    return "subnet";
  }

  constructor(owner, address) {
    super(owner, { name: address });
  }

  get address() {
    return this.name;
  }
}

const ServiceTypes = {
  dns: { prefix: "_dns._udp", port: 53 },
  ldap: { prefix: "_ldap._tcp", port: 389 },
  http: { prefix: "_http._tcp", port: 80 },
  https: { prefix: "_http._tcp", port: 443 },
  rtsp: { prefix: "_rtsp._tcp", port: 554 },
  smtp: { prefix: "_smtp._tcp", port: 25 },
  ssh: { prefix: "_ssh._tcp", port: 22 },
  imap: { prefix: "_imap._tcp", port: 143 },
  imaps: { prefix: "_imaps._tcp", port: 993 },
  dhcp: {}
};

export class Service extends Base {
  alias;
  #weight;
  #priority;
  #type;
  #port;
  #ipAddress;

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
    if (data.ipAddress) {
      this.#ipAddress = data.ipAddress;
      delete data.ipAddress;
    }

    Object.assign(this, data);
    this.owner = owner;
  }

  get prefix() {
    return ServiceTypes[this.type]?.prefix;
  }

  get ipAddress() {
    return this.#ipAddress || this.owner.ipAddress;
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
      "ipAddress",
      "alias",
      "type",
      "master",
      "priority",
      "weight"
    ];
  }
}

const _types = Object.fromEntries(
  [Location, Network, Subnet, Host, /*Model,*/ Service].map(t => [
    t.typeName,
    t
  ])
);

export async function writeLines(dir, name, lines) {
  await mkdir(dir, { recursive: true });
  return writeFile(
    join(dir, name),
    [...lines]
      .flat()
      .filter(line => line !== undefined)
      .map(l => l + "\n")
      .join(""),
    "utf8"
  );
}

export function sectionLines(sectionName, values) {
  const lines = [`[${sectionName}]`];

  for (const [name, value] of Object.entries(values)) {
    lines.push(`${name}=${value}`);
  }

  return lines;
}

function extractFrom(object, propertyNames) {
  const json = {};
  for (const p of propertyNames) {
    const value = object[p];
    if (value !== undefined) {
      json[p] = value;
    }
  }
  return json;
}
