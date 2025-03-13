import { Base } from "./base.mjs";
import { addType } from "./types.mjs";
import { asArray } from "./utils.mjs";
import { networkAddressProperties } from "./network-support.mjs";

const ServiceTypes = {
  dns: { protocol: "udp", port: 53, tls: false },
  ldap: { protocol: "tcp", port: 389, tls: false },
  ldaps: { protocol: "tcp", port: 636, tls: true },
  http: { protocol: "tcp", port: 80, tls: false },
  https: { protocol: "tcp", port: 443, tls: true },
  rtsp: { protocol: "tcp", port: 554, tls: false },
  smtp: { protocol: "tcp", port: 25, tls: false },
  ssh: { protocol: "tcp", port: 22, tls: false },
  imap: { protocol: "tcp", port: 143, tls: false },
  imaps: { protocol: "tcp", port: 993, tls: true },
  dhcp: { tls: false }
};

const ServiceTypeDefinition = {
  name: "service",
  owners: ["host", "cluster"],
  priority: 0.4,
  extends: Base.typeDefinition,
  properties: {
    ...networkAddressProperties,
    ipAddresses: { type: "string", collection: true, writeable: true },
    port: { type: "number", collection: false, writeable: true },
    protocol: { type: "string", collection: false, writeable: true },
    alias: { type: "string", collection: false, writeable: true },
    type: { type: "string", collection: false, writeable: true },
    master: { type: "boolean", collection: false, writeable: true },
    priority: { type: "number", collection: false, writeable: true },
    weight: { type: "number", collection: false, writeable: true },
    srvPrefix: { type: "string", collection: false, writeable: false },
    tls: { type: "string", collection: false, writeable: false }
  }
};

export class Service extends Base {
  alias;
  #weight;
  #priority;
  #type;
  #port;
  #ipAddresses;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return ServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, ServiceTypeDefinition);
  }

  forOwner(owner) {
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

      // @ts-ignore
      return new this.constructor(owner, data);
    }

    return this;
  }

  get server() {
    return this.owner;
  }

  get domainName() {
    return this.server.domainName;
  }

  get ipAddressOrDomainName() {
    return this.rawAddress || this.domainName;
  }

  get rawAddresses() {
    return this.#ipAddresses || this.owner.rawAddresses;
  }

  get rawAddress() {
    return this.#ipAddresses?.[0] || this.server.rawAddress;
  }

  set ipAddresses(value) {
    this.#ipAddresses = value;
  }

  get addresses() {
    return this.rawAddresses.map(a => `${a}:${this.port}`);
  }

  set port(value) {
    this.#port = value;
  }

  get port() {
    return this.#port || ServiceTypes[this.type]?.port;
  }

  set priority(value) {
    this.#priority = value;
  }

  get priority() {
    if (this.#priority !== undefined) {
      return this.#priority;
    }
    if (this.owner.priority !== undefined) {
      return this.owner.priority;
    }

    return 99;
  }

  set weight(value) {
    this.#weight = value;
  }

  get weight() {
    if (this.#weight !== undefined) {
      return this.#weight;
    }
    if (this.owner.weight !== undefined) {
      return this.owner.weight;
    }

    return 1;
  }

  set type(value) {
    this.#type = value;
  }

  get type() {
    return this.#type || this.name;
  }

  get master() {
    return this.owner.master;
  }

  get protocol() {
    return ServiceTypes[this.type]?.protocol;
  }

  get tls() {
    return ServiceTypes[this.type]?.tls || false;
  }

  get srvPrefix() {
    const st = ServiceTypes[this.type];
    if (st?.protocol) {
      return `_${this.type}._${st.protocol}`;
    }
  }
}

export const sortByPriority = (a, b) => a.priority - b.priority;

export function serviceAddresses(
  sources,
  filter,
  addressType = "rawAddresses"
) {
  return asArray(sources)
    .map(ft => Array.from(ft.findServices(filter)))
    .flat()
    .sort(sortByPriority)
    .map(s => s[addressType])
    .flat();
}
