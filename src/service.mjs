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

const ServiceTypeDefinition = {
  name: "service",
  owners: ["host", "cluster"],
  priority: 0.4,
  extends: Base.typeDefinition,
  properties: {
    ipAddresses: { type: "string", collection: true, writeable: true },
    port: { type: "number", collection: false, writeable: true },
    protocol: { type: "string", collection: false, writeable: true },
    alias: { type: "string", collection: false, writeable: true },
    type: { type: "string", collection: false, writeable: true },
    master: { type: "boolean", collection: false, writeable: true },
    priority: { type: "number", collection: false, writeable: true },
    weight: { type: "number", collection: false, writeable: true }
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

  get rawAddress() {
    return this.#ipAddresses?.[0] || this.server.rawAddress;
  }

  set ipAddresses(value) {
    this.#ipAddresses = value;
  }

  get rawAddresses() {
    return this.#ipAddresses || this.owner.rawAddresses;
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

  get srvPrefix() {
    const st = ServiceTypes[this.type];
    if (st?.protocol) {
      return `_${this.type}._${st.protocol}`;
    }
  }
}

export const sortByPriority = (a, b) => a.priority - b.priority;

export function* serviceFilter(services, filter) {
  if (filter) {
    for (const service of services) {
      const filterString = key => {
        if (filter[key] === undefined) {
          return true;
        }
        if (filter[key] === service[key]) {
          return true;
        }

        for(const value of filter[key].split('|')) {
          if(service[key] === value) { return true; }
        }

        return false;
      };

      const filterNumber = key => {
        switch (typeof filter[key]) {
          case "undefined":
            return true;
          case "number":
            return filter[key] === service[key];
          case "string":
            const m = filter[key].match(/^([=><!]+)(\d+)/);
            if (m) {
              const value = parseInt(m[2]);
              switch (m[1]) {
                case "=":
                  return service[key] === value;
                case "!=":
                  return service[key] !== value;
                case "<":
                  return service[key] < value;
                case "<=":
                  return service[key] <= value;
                case ">":
                  return service[key] > value;
                case ">=":
                  return service[key] >= value;
              }
            }
        }
        return false;
      };

      if (
        filterString("type") &&
        filterString("name") &&
        filterString("protocol") &&
        filterString("alias") &&
        filterNumber("priority") &&
        filterNumber("weight") &&
        filterNumber("port")
      ) {
        yield service;
      }
    }
  } else {
    yield* services;
  }
}
