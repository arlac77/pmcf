import {
  addType,
  duration_attribute_writable,
  string_attribute_writable,
  boolean_attribute_writable,
  yesno_attribute_writable
} from "pacc";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints,
  addServiceType
} from "pmcf";
import { filterConfigurable, yesno } from "../utils.mjs";

const SystemdResolvedServiceTypeDefinition = {
  name: "systemd-resolved",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    DNS: { ...string_attribute_writable, configurable: true },
    FallbackDNS: { ...string_attribute_writable, configurable: true },
    Domains: { ...string_attribute_writable, configurable: true },
    MulticastDNS: { ...boolean_attribute_writable, configurable: true },
    Cache: { ...boolean_attribute_writable, configurable: true },
    CacheFromLocalhost: { ...boolean_attribute_writable, configurable: true },
    DNSStubListener: { ...boolean_attribute_writable, configurable: true },
    DNSStubListenerExtra: { ...string_attribute_writable, configurable: true },
    ReadEtcHosts: { ...boolean_attribute_writable, configurable: true },
    ResolveUnicastSingleLabel: {
      ...boolean_attribute_writable,
      configurable: true
    },
    StaleRetentionSec: { ...duration_attribute_writable, configurable: true },
    RefuseRecordTypes: { ...string_attribute_writable, configurable: true },
    DNSSEC: { ...yesno_attribute_writable, default: false, configurable: true },
    DNSOverTLS: { ...yesno_attribute_writable, configurable: true },
    LLMNR: { ...yesno_attribute_writable, configurable: true }
  },
  service: {
    systemdService: "systemd-resolved.service"
  }
};

export class SystemdResolvedService extends ExtraSourceService {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return SystemdResolvedServiceTypeDefinition;
  }

  get type() {
    return SystemdResolvedServiceTypeDefinition.name;
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
      serviceName: this.systemdService,
      configFileName: `etc/systemd/resolved.conf.d/${name}.conf`,
      content: [
        "Resolve",
        {
          DNS: serviceEndpoints(this, options(300, 399, 4)),
          FallbackDNS: serviceEndpoints(this, options(100, 199, 4)),
          Domains: [...this.localDomains].join(" "),
          MulticastDNS: yesno(this.network.multicastDNS),
          ...this.getProperties(filterConfigurable)
        }
      ]
    };
  }
}
