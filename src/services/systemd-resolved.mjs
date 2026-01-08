import {
  addType,
  toExternal,
  duration_attribute_writable,
  string_attribute_writable,
  boolean_attribute_writable,
  yesno_attribute_writable
} from "pacc";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints
} from "pmcf";
import { yesno } from "../utils.mjs";

const SystemdResolvedServiceTypeDefinition = {
  name: "systemd-resolved",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    DNS: string_attribute_writable,
    FallbackDNS: string_attribute_writable,
    Domains: string_attribute_writable,
    MulticastDNS: boolean_attribute_writable,
    Cache: boolean_attribute_writable,
    CacheFromLocalhost: boolean_attribute_writable,
    DNSStubListener: boolean_attribute_writable,
    DNSStubListenerExtra: string_attribute_writable,
    ReadEtcHosts: boolean_attribute_writable,
    ResolveUnicastSingleLabel: boolean_attribute_writable,
    StaleRetentionSec: duration_attribute_writable,
    RefuseRecordTypes: string_attribute_writable,
    DNSSEC: { ...yesno_attribute_writable, default: false },
    DNSOverTLS: yesno_attribute_writable,
    LLMNR: yesno_attribute_writable
  }
};

export class SystemdResolvedService extends ExtraSourceService {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdResolvedServiceTypeDefinition;
  }

  get type() {
    return SystemdResolvedServiceTypeDefinition.name;
  }

  get systemdServices() {
    return this.type;
  }

  systemdConfigs(name) {
    const options = (lower, upper, limit) => {
      return {
        services: `in("dns",types) && priority>=${lower} && priority<=${upper}`,
        endpoints: e =>
          e.networkInterface &&
          e.networkInterface.kind !== "loopback" &&
          e.family !== "dns",
        select: endpoint => endpoint.address,
        join: " ",
        limit
      };
    };

    return {
      serviceName: "systemd-resolved.service",
      configFileName: `etc/systemd/resolved.conf.d/${name}.conf`,
      content: [
        "Resolve",
        {
          DNS: serviceEndpoints(this, options(300, 399, 4)),
          FallbackDNS: serviceEndpoints(this, options(100, 199, 4)),
          Domains: [...this.localDomains].join(" "),
          MulticastDNS: yesno(this.network.multicastDNS),

          // TODO extendet properties with getAttribute()
          ...Object.fromEntries(
            Object.entries(SystemdResolvedServiceTypeDefinition.attributes)
              .map(([k, v]) => [k, toExternal(this.extendedProperty(k), v)])
              .filter(([k, v]) => v !== undefined)
          )
        }
      ]
    };
  }
}
