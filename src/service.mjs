import { Base, Host, Endpoint, DomainNameEndpoint } from "pmcf";
import { addType } from "./types.mjs";
import { asArray } from "./utils.mjs";
import { networkAddressProperties } from "./network-support.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsFormatParameters,
  dnsMergeParameters
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
    type: "https",
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
  dhcp: { endpoints: [{ port: 547, protocol: "udp", tls: false }] },
  "dhcpv6-client": {
    endpoints: [
      { protocol: "tcp", port: 546, tls: false },
      { protocol: "udp", port: 546, tls: false }
    ]
  },
  "dhcpv6-server": { endpoints: [{ port: 547, tls: false }] },
  smb: { endpoints: [{ protocol: "tcp", port: 445, tls: false }] },
  timemachine: {
    type: "adisk",
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
      let ste = ServiceTypes[st.extends];

      if (ste.endpoints) {
        return st.endpoints
          ? [...st.endpoints, ...ste.endpoints]
          : ste.endpoints;
      }
    }

    return st.endpoints;
  }
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
  owners: ["service", "network-interface"],
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

  get ipAddressOrDomainName() {
    return this.address ?? this.domainName;
  }

  get networks() {
    return this.host.networks;
  }

  endpoints(filter) {
    const local =
      this._port === undefined
        ? { type: this.type }
        : { type: this.type, port: this._port };

    const data = serviceTypeEndpoints(this.type) || [
      {
        tls: false
      }
    ];

    let result = [...this.host.networkAddresses()]
      .map(na =>
        data.map(
          d =>
            new Endpoint(this, na, {
              ...d,
              ...local
            })
        )
      )
      .flat();

    if (result.length === 0) {
      result = data.map(
        d => new DomainNameEndpoint(this, this.domainName, { ...d, ...local })
      );
    }

    return filter ? result.filter(filter) : result;
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
    return this.endpoints()[0].port;
  }

  get protocol() {
    return this.endpoints()[0].protocol;
  }

  get tls() {
    return this.endpoints()[0].tls;
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
    if (this.priority <= 1 && this.alias) {
      records.push(DNSRecord(this.alias, "CNAME", dnsFullName(domainName)));
    }

    if (hasSVRRecords) {
      for (const ep of this.endpoints(
        e => e.protocol && e.networkInterface.kind !== "loopback"
      )) {
        records.push(
          DNSRecord(
            dnsFullName(
              `_${ServiceTypes[this.type]?.type ?? this.type}._${
                ep.protocol
              }.${domainName}`
            ),
            "SRV",
            this.priority ?? 10,
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
            this.priority ?? 10,
            ".",
            dnsFormatParameters(parameters)
          )
        );
      } else {
        records.push(
          DNSRecord("@", dnsRecord.type, this.priority, dnsFullName(domainName))
        );
      }
    }

    return records;
  }
}

export const sortByPriority = (a, b) => a.priority - b.priority;

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
