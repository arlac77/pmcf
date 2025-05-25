import { Base, Host, Endpoint, DomainNameEndpoint } from "pmcf";
import { addType } from "./types.mjs";
import { asArray } from "./utils.mjs";
import { networkAddressProperties } from "./network-support.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsFormatParameters,
  dnsMergeParameters,
  dnsPriority
} from "./dns-utils.mjs";

const ServiceTypes = {
  "pacman-repo": {
    extends: ["https"]
  },
  ntp: { endpoints: [{ protocol: "udp", port: 123, tls: false }] },
  dns: { endpoints: [{ protocol: "udp", port: 53, tls: false }] },
  ldap: { endpoints: [{ protocol: "tcp", port: 389, tls: false }] },
  ldaps: { endpoints: [{ protocol: "tcp", port: 636, tls: true }] },
  http: { endpoints: [{ protocol: "tcp", port: 80, tls: false }] },
  https: {
    endpoints: [{ protocol: "tcp", port: 443, tls: true }],
    dnsRecord: { type: "HTTPS", parameters: { alpn: "h2" } }
  },
  http3: {
    extends: ["https"],
    dnsRecord: {
      type: "HTTPS",
      parameters: { "no-default-alpn": undefined, alpn: "h3" }
    }
  },
  rtsp: { endpoints: [{ protocol: "tcp", port: 554, tls: false }] },
  smtp: {
    endpoints: [{ protocol: "tcp", port: 25, tls: false }],
    dnsRecord: { type: "MX" }
  },
  ssh: { endpoints: [{ protocol: "tcp", port: 22, tls: false }] },
  imap: { endpoints: [{ protocol: "tcp", port: 143, tls: false }] },
  imaps: { endpoints: [{ protocol: "tcp", port: 993, tls: true }] },
  dhcp: { endpoints: [{ protocol: "udp", port: 547, tls: false }] },
  "dhcpv6-client": {
    endpoints: [
      { protocol: "tcp", port: 546, tls: false },
      { protocol: "udp", port: 546, tls: false }
    ]
  },
  "dhcpv6-server": { endpoints: [{ port: 547, tls: false }] },
  smb: { endpoints: [{ protocol: "tcp", port: 445, tls: false }] },
  timemachine: {
    extends: ["smb"],
    endpoints: [{ protocol: "tcp", port: 445, tls: false }],
    dnsRecord: {
      type: "TXT",
      parameters: {
        sys: "waMa=0",
        adVF: "0x100",
        dk0: "adVN=MF-TM-999"
        //  adVF: "0x82"
      }
    }
  }
};

function serviceTypeEndpoints(type) {
  let st = ServiceTypes[type];
  if (st) {
    if (st.extends) {
      return st.extends.reduce(
        (a, c) => [...a, ...(ServiceTypes[c]?.endpoints || [])],
        st.endpoints || []
      );
    }

    return st.endpoints;
  }

  return [
    {
      tls: false
    }
  ];
}

export const endpointProperties = {
  port: { type: "number", collection: false, writeable: true },
  protocol: {
    type: "string",
    collection: false,
    writeable: true,
    values: ["tcp", "udp"]
  },
  type: { type: "string", collection: false, writeable: true },
  tls: {
    type: "boolean",
    collection: false,
    writeable: false,
    default: false
  }
};

export const EndpointTypeDefinition = {
  name: "endpoint",
  owners: ["service", "network_interface"],
  priority: 0.4,
  specializations: {},
  properties: endpointProperties
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
  properties: {
    ...networkAddressProperties,
    ...endpointProperties,
    alias: { type: "string", collection: false, writeable: true },
    weight: { type: "number", collection: false, writeable: true, default: 1 },
    systemd: { type: "string", collection: true, writeable: true }
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

  constructor(owner, data) {
    super(owner, data);
    this.read(data, ServiceTypeDefinition);
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

  endpoints(filter) {
    const data = serviceTypeEndpoints(this.type);

    const l = this._port === undefined ? {} : { port: this._port };
    let result = [...this.host.networkAddresses()]
      .map(na => data.map(d => new Endpoint(this, na, { ...d, ...l })))
      .flat();

    if (result.length === 0) {
      result = data.map(
        d => new DomainNameEndpoint(this, this.domainName, { ...d, ...l })
      );
    }

    return filter ? result.filter(filter) : result;
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

export const sortByPriority = (a, b) => a.priority - b.priority;
export const sortInverseByPriority = (a, b) => b.priority - a.priority;

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
    .sort(sortByPriority)
    .map(service => service.endpoints(options.endpoints))
    .flat();

  const res = [...new Set(options.select ? all.map(options.select) : all)];

  if (options.limit < res.length) {
    res.length = options.limit;
  }

  return options.join ? res.join(options.join) : res;
}
