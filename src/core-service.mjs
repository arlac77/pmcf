import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import {
  string_attribute_writable,
  number_attribute_writable,
  string_set_attribute,
  default_collection_attribute_writable,
  boolean_attribute_false,
  port_attribute_writable,
  type_attribute_writable,
  priority_attribute
} from "pacc";
import {
  Base,
  Host,
  Endpoint,
  DomainNameEndpoint,
  HTTPEndpoint,
  UnixEndpoint,
  addType
} from "pmcf";
import { asArray } from "./utils.mjs";
import { networkAddressAttributes } from "./common-attributes.mjs";
import {
  serviceTypeEndpoints,
  serviceTypes,
  ServiceTypes
} from "./service-types.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsFormatParameters,
  dnsMergeParameters,
  dnsPriority
} from "./dns-utils.mjs";

export const endpointAttributes = {
  port: port_attribute_writable,
  protocol: {
    ...string_attribute_writable,
    name: "protocol",
    values: new Set(["tcp", "udp", "quic"])
  },
  type: type_attribute_writable,
  types: { ...string_set_attribute, name: "types" },
  tls: { ...boolean_attribute_false, name: "tls" }
};

export class CoreService extends Base {
  static name = "core-service";
  static priority = 1.1;
  static owners = [Host, "cluster", "network_interface"];
  static specializationOf = CoreService;
  static specializations = {};
  static factoryFor(owner, value) {
    const type = value.type ?? value.name;
    const st = this.specializations[type];

    if (st) {
      delete value.type;
      return st;
    }

    return baseServiceClass;
  }
  static attributes = {
    ...networkAddressAttributes,
    ...endpointAttributes,
    extends: {
      ...default_collection_attribute_writable,
      name: "extends",
      type: CoreService
    },
    alias: { ...string_attribute_writable, name: "alias" },
    priority: priority_attribute,
    weight: { ...number_attribute_writable, name: "weight" /*default: 1*/ },
    systemdService: { ...string_attribute_writable, name: "systemdService" }
  };

  static {
    addType(this);
  }

  _alias;
  _weight;
  _port;
  _systemdService;

  toString() {
    return `${this.fullName}(${this.type})`;
  }

  get network() {
    return this.host.network;
  }

  get host() {
    if (this.owner instanceof Host) {
      return this.owner;
    }
  }

  get hosts() {
    return this.owner.hosts;
  }

  get domainName() {
    return this.host?.domainName;
  }

  get networks() {
    return this.host.networks;
  }

  get subnets() {
    return this.host.subnets;
  }

  get url() {
    return this.endpoint()?.url;
  }

  get serviceTypeEndpoints() {
    return serviceTypeEndpoints(ServiceTypes[this.type]);
  }

  endpoints(filter) {
    const data = serviceTypeEndpoints(ServiceTypes[this.type]);
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
        case FAMILY_IPV4:
        case FAMILY_IPV6:
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
      endpoints: e =>
        e.networkInterface && e.networkInterface.kind !== "loopbak",
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
    return this.attribute("_alias");
  }

  set port(value) {
    this._port = value;
  }

  get port() {
    return (
      this.attribute("_port") ??
      serviceTypeEndpoints(ServiceTypes[this.type])[0]?.port
    );
  }

  set priority(value) {
    this._priority = value;
  }

  get priority() {
    return this.attribute("_priority") ?? this.owner?.priority ?? 1;
  }

  set weight(value) {
    this._weight = value;
  }

  get weight() {
    return this.attribute("_weight") ?? this.owner.weight ?? 1;
  }

  get type() {
    return this.constructor.name;
  }

  get types() {
    return serviceTypes(ServiceTypes[this.type]);
  }

  get systemdService() {
    return (
      this.attribute("_systemdService") ??
      ServiceTypes[this.type]?.systemdService
    );
  }

  get packageData() {
    const packageData = super.packageData;
    const name = `${this.owner.owner.name}-${this.owner.name}`;
    packageData.properties.name = `${this.name}-${name}`;
    packageData.properties.description = `${this.type} service definitions for ${this.fullName}`;
    packageData.properties.groups.push("service-config", name);
    return packageData;
  }

  async *preparePackages(dir) {
    const pd = this.packageData;
    pd.sources = await Array.fromAsync(this.templateContent());
    if (pd.sources.length) {
      yield pd;
    }
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
        for (const service of this.services) {
          if (service !== this) {
            const serviceType = ServiceTypes[service.type];
            /*if(!serviceType) {
              throw new Error(`Unknown service '${service.type}'`);
            }*/
            const r = serviceType?.dnsRecord;

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

export let baseServiceClass = CoreService;

export function setBaseService(value) {
  baseServiceClass = value;
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
    .map(source => Array.from(source.expression(options.services)))
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
