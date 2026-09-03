import {
  FAMILY_IPV4,
  FAMILY_IPV6,
  ADDRESS_TYPE_LOOPBACK,
  addressType
} from "ip-utilties";
import {
  string_attribute_writable,
  number_attribute_writable,
  priority_attribute,
  asArray
} from "pacc";
import {
  base,
  Host,
  Endpoint,
  DomainNameEndpoint,
  HTTPEndpoint,
  unix_endpoint,
  addType,
  FAMILY_UNIX,
  FAMILY_DNS
} from "pmcf";
import {
  networkAddressAttributes,
  extends_attribute,
  endpointAttributes
} from "./common-attributes.mjs";
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

export class CoreService extends base {
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
      ...extends_attribute,
      type: CoreService
    },
    priority: priority_attribute,
    weight: { ...number_attribute_writable, name: "weight" /*default: 1*/ },
    systemdService: { ...string_attribute_writable, name: "systemdService" },
    systemUserName: { ...string_attribute_writable, name: "systemUserName" },
    systemGroupName: { ...string_attribute_writable, name: "systemGroupName" }
  };

  static {
    addType(this);
  }

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
    return this.owner.host;
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
    const data = serviceTypeEndpoints(ServiceTypes[this.type], true);
    const result = [];

    const domainNames = new Set([undefined]);

    for (const e of data) {
      switch (e.family) {
        case FAMILY_UNIX:
          result.push(new unix_endpoint(this, e.path, e));
          break;

        case undefined:
        case FAMILY_DNS:
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

  set port(value) {
    this._port = value;
  }

  get port() {
    const p = this.attribute("_port");
    if (p !== undefined) {
      return p;
    }

    const st = ServiceTypes[this.type];

    if (st) {
      const ste = serviceTypeEndpoints(st);

      const e = ste.find(t => t.type.name === this.type);
      if (e) {
        return e.port;
      }

      for (const sst of st.extends) {
        const e = ste.find(t => t.type.name === sst.name);
        if (e) {
          return e.port;
        }
      }
    }
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

  set systemUserName(value) {
    this._systemUserName = value;
  }

  get systemUserName() {
    return (
      this.attribute("_systemUserName") ??
      ServiceTypes[this.type]?.systemUserName ??
      super.systemUserName
    );
  }

  set systemGroupName(value) {
    this._systemGroupName = value;
  }

  get systemGroupName() {
    return (
      this.attribute("_systemGroupName") ??
      ServiceTypes[this.type]?.systemGroupName ??
      super.systemGroupName
    );
  }

  dnsRecordsForDomainName(domainName, hasSVRRecords) {
    const records = [];

    if (this.priority >= 390) {
      for (const alias of this.aliases) {
        records.push(DNSRecord(alias, "CNAME", dnsFullName(domainName)));
      }
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

export function endpoints(entries) {
  return asArray(entries)
    .map(e => e.endpoints())
    .flat();
}

export function endpointAddresses(entries) {
  return endpoints(entries)
    .filter(
      e =>
        e.networkAddress &&
        addressType(e.networkAddress.address) !== ADDRESS_TYPE_LOOPBACK
    )
    .map(e => e.networkAddress.address);
}
