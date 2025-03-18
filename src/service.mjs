import { Base } from "./base.mjs";
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
  dns: { protocol: "udp", port: 53, tls: false },
  ldap: { protocol: "tcp", port: 389, tls: false },
  ldaps: { protocol: "tcp", port: 636, tls: true },
  http: { protocol: "tcp", port: 80, tls: false },
  https: {
    protocol: "tcp",
    port: 443,
    tls: true,
    dnsRecord: { type: "HTTPS", parameters: { alpn: "h2" } }
  },
  http3: {
    type: "https",
    protocol: "tcp",
    port: 443,
    tls: true,
    dnsRecord: {
      type: "HTTPS",
      parameters: { "no-default-alpn": undefined, alpn: "h3" }
    }
  },
  rtsp: { protocol: "tcp", port: 554, tls: false },
  smtp: { protocol: "tcp", port: 25, tls: false, dnsRecord: { type: "MX" } },
  ssh: { protocol: "tcp", port: 22, tls: false },
  imap: { protocol: "tcp", port: 143, tls: false },
  imaps: { protocol: "tcp", port: 993, tls: true },
  dhcp: { tls: false },
  smb: { protocol: "tcp", port: 445, tls: false },
  timemachine: {
    type: "adisk",
    protocol: "tcp",
    tls: false,
    dnsRecord: {
      type: "TXT",
      parameters: {
        sys: "waMa=0",
        adVF: "0x100",
        dk0: "adVN=MF-TM-999",
      //  adVF: "0x82"
      }
    }
  }
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
    tls: { type: "string", collection: false, writeable: false },
    systemd: { type: "string", collection: true, writeable: true }
  }
};

export class Service extends Base {
  alias;
  #weight;
  #priority;
  #type;
  #port;
  #ipAddresses;
  #systemd;

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

      if (this.#systemd) {
        data.systemd = this.#systemd;
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

  get systemdServices() {
    return this.#systemd;
  }

  get srvPrefix() {
    const st = ServiceTypes[this.type];
    if (st?.protocol) {
      return `_${st.type || this.type}._${st.protocol}`;
    }
  }

  dnsRecordsForDomainName(domainName, hasSVRRecords) {
    const records = [];
    if (this.master && this.alias) {
      records.push(DNSRecord(this.alias, "CNAME", dnsFullName(domainName)));
    }

    if (hasSVRRecords && this.srvPrefix) {
      records.push(
        DNSRecord(
          dnsFullName(`${this.srvPrefix}.${domainName}`),
          "SRV",
          this.priority,
          this.weight,
          this.port,
          dnsFullName(this.domainName)
        )
      );
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
            this.priority,
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
  addressType = "rawAddresses"
) {
  return asArray(sources)
    .map(ft => Array.from(ft.findServices(filter)))
    .flat()
    .sort(sortByPriority)
    .map(s => s[addressType])
    .flat();
}
