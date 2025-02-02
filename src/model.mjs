import { readFile, glob } from "node:fs/promises";
import { join } from "node:path";
import {
  asArray,
  isIPv4Address,
  isIPv6Address,
  normalizeIPAddress
} from "./utils.mjs";
import { Base } from "./base.mjs";
import { Owner, Network, Subnet } from "./owner.mjs";
import { Service } from "./service.mjs";
import { Cluster } from "./cluster.mjs";
import { DNSService } from "./dns.mjs";

export class Root extends Owner {
  static get types() {
    return _typesByName;
  }

  static get typeName() {
    return "root";
  }

  constructor(directory) {
    super(undefined, { name: "" });
    this.directory = directory;
    this.addObject(this);
  }

  get fullName() {
    return "";
  }

  get root() {
    return this;
  }

  async load(name, options) {
    const fullName = Base.normalizeName(name);
    let object = this.named(fullName);
    if (object) {
      return object;
    }

    //console.log("LOAD", fullName);

    let path = fullName.split("/");
    path.pop();

    let data;
    let type = options?.type;
    if (type) {
      data = JSON.parse(
        await readFile(
          join(this.directory, fullName, type.typeFileName),
          "utf8"
        )
      );
    } else {
      for (type of _types) {
        try {
          data = JSON.parse(
            await readFile(
              join(this.directory, fullName, type.typeFileName),
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
    const n = fullName[length] === "/" ? length + 1 : length;
    data.name = fullName.substring(n);

    type = await type.prepareData(this, data);

    object = new type(owner, data);

    this._addObject(type.typeName, fullName, object);

    //console.log("FINISH LOAD", object.fullName);

    return object;
  }

  async loadAll() {
    for (let type of Object.values(Root.types)) {
      for await (const name of glob(type.fileNameGlob, {
        cwd: this.directory
      })) {
        await this.load(name, { type });
      }
    }

    this.execFinalize();
  }
}

export class Location extends Owner {
  static get typeName() {
    return "location";
  }

  get location() {
    return this;
  }

  locationNamed(name) {
    if (this.fullName === name) {
      return this;
    }

    return super.locationNamed(name);
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

  static get typeName() {
    return "host";
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

    Object.assign(this, data);

    for (const [name, iface] of Object.entries(this.networkInterfaces)) {
      iface.name = name;
      new NetworkInterface(this, iface);
    }

    owner.addObject(this);
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const ni of Object.values(this.networkInterfaces)) {
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

  addNetworkInterface(networkInterface) {
    this.networkInterfaces[networkInterface.name] = networkInterface;

    if (networkInterface.network) {
      networkInterface.network.addObject(this);
    }
  }

  *networkAddresses() {
    for (const networkInterface of Object.values(this.networkInterfaces)) {
      for (const address of networkInterface.ipAddresses) {
        yield { address, networkInterface };
      }
    }
  }

  get ipAddresses() {
    return [...this.networkAddresses()].map(na =>
      normalizeIPAddress(na.address)
    );
  }

  get ipAddress() {
    return this.ipAddresses[0];
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

  #ipAddresses = [];
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

    if (data.ipv4) {
      this.#ipAddresses.push(...asArray(data.ipv4));
      delete data.ipv4;
    }

    if (data.ipv6) {
      this.#ipAddresses.push(...asArray(data.ipv6));
      delete data.ipv6;
    }

    if (data.ipAddresses) {
      this.#ipAddresses.push(...asArray(data.ipAddresses));
      delete data.ipAddresses;
    }

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

  get ipAddresses() {
    return this.#ipAddresses;
  }

  get ipAddressesWithPrefixLength() {
    return this.#ipAddresses.map(a =>
      isIPv4Address(a) ? `${a}/${this.prefixLength}` : a
    );
  }

  get ipv4Addresses() {
    return this.#ipAddresses.filter(a => isIPv4Address(a));
  }

  get ipv6Addresses() {
    return this.#ipAddresses.filter(a => isIPv6Address(a));
  }

  get prefixLength()
  {
    return this.network?.prefixLength;
  }

  get network() {
    return this.#network;
  }

  set network(networkOrName) {
    if (!(networkOrName instanceof Network)) {
      let network = this.owner.owner.networkNamed(networkOrName);

      if (network) {
        this.#network = network;
        return;
      } else {
        this.error("Unknown network", networkOrName);
      }
    }

    this.#network = networkOrName;
  }

  get host() {
    return this.owner;
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

  get propertyNames() {
    return [
      ...super.propertyNames,
      "arpbridge",
      "hwaddr",
      "network",
      "ssid",
      "psk",
      "scope",
      "metric",
      "ipAddresses",
      "kind"
    ];
  }
}

const _types = [
  Owner,
  Location,
  Network,
  Subnet,
  Host,
  Cluster,
  Service,
  DNSService,
  NetworkInterface
];
const _typesByName = Object.fromEntries(_types.map(t => [t.typeName, t]));
