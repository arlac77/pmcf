import {
  string_attribute_writable,
  string_collection_attribute,
  string_collection_attribute_writable,
  number_attribute_writable,
  boolean_attribute_false
} from "pacc";
import {
  Base,
  Host,
  Endpoint,
  DomainNameEndpoint,
  HTTPEndpoint,
  UnixEndpoint
} from "pmcf";
import { addType } from "./types.mjs";
import { asArray } from "./utils.mjs";
import { networkAddressAttributes } from "./network-support.mjs";
import { serviceTypeEndpoints, ServiceTypes } from "./service-types.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsFormatParameters,
  dnsMergeParameters,
  dnsPriority
} from "./dns-utils.mjs";

export const endpointAttributes = {
  port: number_attribute_writable,
  protocol: {
    ...string_attribute_writable,
    values: ["tcp", "udp"]
  },
  type: string_attribute_writable,
  types: string_collection_attribute,
  tls: boolean_attribute_false
};

export const EndpointTypeDefinition = {
  name: "endpoint",
  owners: ["service", "network_interface"],
  priority: 0.4,
  specializations: {},
  attributes: endpointAttributes
};

export const ServiceTypeDefinition = {
  name: "service",
  owners: ["host", "cluster", "network_interface"],
  priority: 0.4,
  extends: Base.typeDefinition,
  specializations: {},
  factoryFor(owner, value) {
    const type = value.type ?? value.name;
    const t = ServiceTypeDefinition.specializations[type];

    if (t) {
      delete value.type;
      return t.clazz;
    }

    return Service;
  },
  attributes: {
    ...networkAddressAttributes,
    ...endpointAttributes,
    alias: string_attribute_writable,
    weight: { ...number_attribute_writable /*default: 1*/ },
    systemd: string_collection_attribute_writable
  }
};

export class Service extends Base {
  _alias;
  _weight;
  _type;
  _port;
  _systemd;
  _extends = [];

  static {
    addType(this);
  }

  static get typeDefinition() {
    return ServiceTypeDefinition;
  }

  toString() {
    return `${super.toString()}[${this.type}]`;
  }

  set extends(value) {
    this._extends.push(value);
  }

  get extends() {
    return this._extends;
  }

  get network() {
    return this.host.network;
  }

  get host() {
    if (this.owner instanceof Host) {
      return this.owner;
    }
  }

  *hosts() {
    yield* this.owner.hosts();
  }

  get domainName() {
    return this.host.domainName;
  }

  get networks() {
    return this.host.networks;
  }

  get subnets() {
    return this.host.subnets;
  }

  get serviceTypeEndpoints() {
    return serviceTypeEndpoints(this.type);
  }

  endpoints(filter) {
    const data = serviceTypeEndpoints(this.type);
    if (!data) {
      return [];
    }

    const result = [];

    const domainNames = new Set([undefined]);

    for (const e of data) {
      switch (e.family) {
        case "unix":
          result.push(new UnixEndpoint(this, e.path, e));
          break;

        case undefined:
        case "dns":
        case "IPv4":
        case "IPv6":
          const options =
            this._port === undefined ? { ...e } : { ...e, port: this._port };
          delete options.kind;

          for (const na of this.host.networkAddresses()) {
            if (e.kind && e.kind !== na.networkInterface.kind) {
              continue;
            }

            if (e.pathname) {
              result.push(new HTTPEndpoint(this, na, options));
            } else {
              if (e.family === na.family) {
                result.push(new Endpoint(this, na, options));
              }
            }
          }

          if (!domainNames.has(this.domainName)) {
            domainNames.add(this.domainName);
            result.push(new DomainNameEndpoint(this, this.domainName, options));
          }

          break;
      }
    }

    switch (typeof filter) {
      case "string":
        return result.filter(endpoint => endpoint.type === filter);

      case "undefined":
        return result;

      default:
        return result.filter(filter);
    }
  }

  endpoint(filter) {
    return this.endpoints(filter)[0];
  }

  address(
    options = {
      endpoints: e => e.networkInterface?.kind !== "loopbak",
      select: e => e.domainName || e.address,
      limit: 1,
      join: ""
    }
  ) {
    const all = this.endpoints(options.endpoints);
    const res = [...new Set(options.select ? all.map(options.select) : all)];

    if (options.limit < res.length) {
      res.length = options.limit;
    }

    return options.join !== undefined ? res.join(options.join) : res;
  }

  set alias(value) {
    this._alias = value;
  }

  get alias() {
    return this.extendedProperty("_alias");
  }

  set port(value) {
    this._port = value;
  }

  get port() {
    return this._port ?? serviceTypeEndpoints(this.type)[0].port;
  }

  set weight(value) {
    this._weight = value;
  }

  get weight() {
    return this.extendedProperty("_weight") ?? this.owner.weight ?? 1;
  }

  set type(value) {
    this._type = value;
  }

  get type() {
    return this._type ?? this.name;
  }

  get types() {
    return new Set([...this._extendedPropertyIterator("type", new Set())]);
  }

  get systemdServices() {
    return this.extendedProperty("_systemd");
  }

  dnsRecordsForDomainName(domainName, hasSVRRecords) {
    const records = [];
    if (this.priority >= 390 && this.alias) {
      records.push(DNSRecord(this.alias, "CNAME", dnsFullName(domainName)));
    }

    if (hasSVRRecords) {
      for (const ep of this.endpoints(
        e =>
          e.protocol &&
          e.networkInterface &&
          e.networkInterface.kind !== "loopback"
      )) {
        records.push(
          DNSRecord(
            dnsFullName(`_${this.type}._${ep.protocol}.${domainName}`),
            "SRV",
            dnsPriority(this.priority),
            this.weight,
            ep.port,
            dnsFullName(this.domainName)
          )
        );
        break; // TODO only one ?
      }
    }

    const dnsRecord = ServiceTypes[this.type]?.dnsRecord;
    if (dnsRecord) {
      let parameters = dnsRecord.parameters;

      if (parameters) {
        for (const service of this.findServices()) {
          if (service !== this) {
            const r = ServiceTypes[service.type]?.dnsRecord;

            if (r?.type === dnsRecord.type) {
              parameters = dnsMergeParameters(parameters, r.parameters);
            }
          }
        }

        records.push(
          DNSRecord(
            dnsFullName(domainName),
            dnsRecord.type,
            dnsPriority(this.priority),
            ".",
            dnsFormatParameters(parameters)
          )
        );
      } else {
        records.push(
          DNSRecord(
            "@",
            dnsRecord.type,
            dnsPriority(this.priority),
            dnsFullName(domainName)
          )
        );
      }
    }

    return records;
  }
}

export const sortAscendingByPriority = (a, b) => a.priority - b.priority;
export const sortDescendingByPriority = (a, b) => b.priority - a.priority;

/**
 *
 * @param {*} sources
 * @param {Object} [options]
 * @param {Function} [options.services] filter for services
 * @param {Function} [options.endpoints] filter for endpoints
 * @param {Function} [options.select] mapper from Endpoint into result
 * @param {number} [options.limit] upper limit of # result items
 * @param {string} [options.join] join result(s) into a string
 * @returns {string|any}
 */
export function serviceEndpoints(sources, options = {}) {
  const all = asArray(sources)
    .map(ft => Array.from(ft.findServices(options.services)))
    .flat()
    .sort(sortDescendingByPriority)
    .map(service => service.endpoints(options.endpoints))
    .flat();

  const res = [...new Set(options.select ? all.map(options.select) : all)];

  if (options.limit < res.length) {
    res.length = options.limit;
  }

  return options.join ? res.join(options.join) : res;
}
