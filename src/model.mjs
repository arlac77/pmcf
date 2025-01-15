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

  get host() {
    if (this instanceof Host) {
      return this;
    }
    return this.owner.host;
  }

  get network() {
    if (this instanceof Network) {
      return this;
    }
    return this.owner.network;
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

  toJSON() {
    return {
      name: this.name,
      directory: this.directory,
      owner: this.owner.name,
      description: this.description
    };
  }
}

export class World {
  static get types() {
    return _types;
  }

  directory;
  #byName = new Map();

  /** @typedef {Map<string,Host>} */ #hosts = new Map();

  constructor(directory) {
    this.directory = directory;
  }

  get name() {
    return "";
  }

  async load() {
    for (const type of Object.values(World.types)) {
      for await (const name of glob(type.fileNameGlob, {
        cwd: this.directory
      })) {
        const baseName = type.baseName(name);
        if (!this.#byName.get(baseName)) {
          const data = JSON.parse(
            await readFile(join(this.directory, name), "utf8")
          );

          data.name = baseName;
          const object = new type(this, data);
          this.#byName.set(data.name, object);
        }
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
    if (this.#hosts.size > 0) {
      for (const host of this.#hosts.values()) {
        yield host;
      }
    }

    for await (const name of glob(Host.fileNameGlob, {
      cwd: this.directory
    })) {
      yield this.host(name);
    }
  }

  async *domains() {
    for await (const location of this.locations()) {
      yield location.domain;
    }
  }

  async location(name) {
    return this.#byName.get(Location.baseName(name));
  }

  async host(name) {
    name = Host.baseName(name);

    if (name === undefined) {
      return undefined;
    }

    let host = this.#hosts.get(name);
    if (host) {
      return host;
    }

    const directory = join(this.directory, name);
    const data = JSON.parse(
      await readFile(join(directory, Host.typeFileName), "utf8")
    );

    data.directory = directory;

    if (!data.name) {
      data.name = name;
    } else {
      name = data.name;
    }

    if (!data.location) {
      const parts = name.split(/\//);

      if (parts.length > 1 && parts[0] !== "services" && parts[0] !== "model") {
        data.location = parts[0];
      }
    }

    data.location = await this.location(data.location);

    if (data.extends) {
      data.extends = await Promise.all(data.extends.map(e => this.host(e)));
    }

    host = new (data.name.indexOf("model/") >= 0 ? Model : Host)(this, data);

    this.#hosts.set(name, host);
    return host;
  }

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
  location;
  #extends = [];
  #provides = new Set();
  #replaces = new Set();
  #depends = new Set();
  #master = false;
  #os;
  #distribution;
  #deployment;

  static get typeName() {
    return "host";
  }

  constructor(owner, data) {
    super(owner, data);

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

    this.location?.addHost(this);

    for (const [name, iface] of Object.entries(this.networkInterfaces)) {
      iface.host = this;
      iface.name = name;
      if (iface.network) {
        iface.network = this.location?.network(iface.network);
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

  toJSON() {
    return {
      ...super.toJSON(),
      ...Object.fromEntries(
        [
          "location",
          "model",
          "os",
          "distribution",
          "deployment",
          "replaces",
          "depends",
          "master",
          "networkInterfaces"
        ]
          .filter(p => this[p])
          .map(p => [p, this[p]])
      ),
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

  toJSON() {
    return {
      ...super.toJSON(),
      domain: this.domain,
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

  toJSON() {
    return {
      ...super.toJSON(),
      kind: this.kind,
      ipv4: this.ipv4,
      scope: this.scope,
      metric: this.metric
    };
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

  toJSON() {
    return {
      ...super.toJSON(),
      ipAddress: this.ipAddress,
      alias: this.alias,
      type: this.type,
      master: this.master,
      priority: this.priority,
      weight: this.weight
    };
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
