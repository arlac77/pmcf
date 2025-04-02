import { Base } from "./base.mjs";
import { addType } from "./types.mjs";
import { asArray, isLocalhost } from "./utils.mjs";
import { networkAddressProperties } from "./network-support.mjs";
import {
  DNSRecord,
  dnsFullName,
  dnsFormatParameters,
  dnsMergeParameters
} from "./dns-utils.mjs";

const ServiceTypes = {
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
    type: "https",
    endpoints: [{ protocol: "tcp", port: 443, tls: true }],
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
  dhcp: { endpoints: [{ port: 547, tls: false }] },
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

export const ServiceTypeDefinition = {
  name: "service",
  owners: ["host", "cluster"],
  priority: 0.4,
  extends: Base.typeDefinition,
  specializations: {},
  factoryFor(value) {
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
    ipAddresses: { type: "string", collection: true, writeable: true },
    port: { type: "number", collection: false, writeable: true },
    protocol: {
      type: "string",
      collection: false,
      writeable: true,
      values: ["tcp", "udp"]
    },
    alias: { type: "string", collection: false, writeable: true },
    type: { type: "string", collection: false, writeable: true },
    weight: { type: "number", collection: false, writeable: true },
    tls: { type: "string", collection: false, writeable: false },
    systemd: { type: "string", collection: true, writeable: true }
  }
};

export class Service extends Base {
  alias;
  _weight;
  _type;
  _port;
  _ipAddresses;
  _systemd;

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

  get network() {
    return this.server.network;
  }

  get server() {
    return this.owner;
  }

  get domainName() {
    return this.server.domainName;
  }

  get ipAddressOrDomainName() {
    return this.rawAddress ?? this.domainName;
  }

  get rawAddresses() {
    return this._ipAddresses ?? this.owner.rawAddresses;
  }

  get rawAddress() {
    return this._ipAddresses?.[0] ?? this.server.rawAddress;
  }

  set ipAddresses(value) {
    this._ipAddresses = value;
  }

  get addresses() {
    return this.rawAddresses.map(a => `${a}:${this.port}`);
  }

  get endpoints() {
    if (!ServiceTypes[this.type]) {
      return [
        { address: this.rawAddress, port: this._port, tls: false }
      ];
    }

    return ServiceTypes[this.type].endpoints;
  }

  set port(value) {
    this._port = value;
  }

  get port() {
    return this.endpoints[0].port;
  }

  get protocol() {
    return this.endpoints[0].protocol;
  }

  get tls() {
    return this.endpoints[0].tls;
  }

  set weight(value) {
    this._weight = value;
  }

  get weight() {
    return this._weight ?? this.owner.weight ?? 1;
  }

  set type(value) {
    this._type = value;
  }

  get type() {
    return this._type ?? this.name;
  }

  get systemdServices() {
    return this._systemd;
  }

  dnsRecordsForDomainName(domainName, hasSVRRecords) {
    const records = [];
    if (this.priority <= 1 && this.alias) {
      records.push(DNSRecord(this.alias, "CNAME", dnsFullName(domainName)));
    }

    if (hasSVRRecords) {
      for (const ep of this.endpoints.filter(e => e.protocol)) {
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

export function serviceAddresses(
  sources,
  filter,
  addressType = "rawAddresses",
  addressFilter = a => !isLocalhost(a)
) {
  return asArray(sources)
    .map(ft => Array.from(ft.findServices(filter)))
    .flat()
    .sort(sortByPriority)
    .map(s => s[addressType])
    .flat()
    .filter(addressFilter);
}
