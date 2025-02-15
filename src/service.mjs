import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

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

  static {
    addType(this);
  }

  static get typeDefinition() {
    return {
      name: "service",
      extends: Base,
      properties: {
        ipAddresses: { type: "string", collection: true },
        addresses: { type: "string", collection: true },
        port: { type: "number" },
        protocol: { type: "string" },
        alias: { type: "string" },
        type: { type: "string" },
        master: { type: "boolean" },
        priority: { type: "number" },
        weight: { type: "number" }
      }
    };
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

    owner.addService(this);
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

  get protocol() {
    return ServiceTypes[this.type]?.protocol;
  }

  get srvPrefix() {
    const st = ServiceTypes[this.type];
    if (st?.protocol) {
      return `_${this.type}._${st.protocol}`;
    }
  }

  get ipAddresses() {
    return this.#ipAddresses || this.owner.rawAddresses;
  }

  get addresses() {
    return this.ipAddresses.map(a => `${a}:${this.port}`);
  }

  get port() {
    return this.#port || ServiceTypes[this.type]?.port;
  }

  get priority() {
    return this.#priority || this.owner.priority || 99;
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
}
