import {
  addType,
  object_attribute,
  string_collection_attribute_writable,
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
import {
  filterConfigurable,
  yesno,
  sectionLines,
  setionLinesFromPropertyIterator
} from "../utils.mjs";

const SystemdResolvedServiceTypeDefinition = {
  name: "systemd-resolved",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
   /* Resolve: {
      ...object_attribute,
      attributes: {*/
        DNS: { ...string_attribute_writable, configurable: true },
        FallbackDNS: { ...string_attribute_writable, configurable: true },
        
        domains: { externalName: "Domains", ...string_collection_attribute_writable, configurable: true },

        MulticastDNS: { ...yesno_attribute_writable, configurable: true },
        Cache: { ...boolean_attribute_writable, configurable: true },
        CacheFromLocalhost: {
          ...boolean_attribute_writable,
          configurable: true
        },
        DNSStubListener: { ...boolean_attribute_writable, configurable: true },
        DNSStubListenerExtra: {
          ...string_attribute_writable,
          configurable: true
        },
        ReadEtcHosts: { ...boolean_attribute_writable, configurable: true },
        ResolveUnicastSingleLabel: {
          ...boolean_attribute_writable,
          configurable: true
        },
        StaleRetentionSec: {
          ...duration_attribute_writable,
          configurable: true
        },
        RefuseRecordTypes: { ...string_attribute_writable, configurable: true },
        DNSSEC: {
          ...yesno_attribute_writable,
          default: false,
          configurable: true
        },
        DNSOverTLS: { ...yesno_attribute_writable, configurable: true },
        LLMNR: { ...yesno_attribute_writable, configurable: true }
     /* }
    }*/
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
        services: `types[dns] && priority>=${lower} && priority<=${upper}`,
        endpoints: e =>
          e.family == "IPv4" &&
          e.networkInterface &&
          e.networkInterface.kind !== "loopback",
          //e.family !== "dns",
        select: endpoint => endpoint.address,
        join: " ",
        limit
      };
    };

   //console.log([...this.owner.expression('services[in("dns",types) && priority>=300 && priority<=399].owner.name')]);

    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/resolved.conf.d/${name}.conf`,
      //content: [...setionLinesFromPropertyIterator(this.propertyIterator( filterConfigurable)), "A=1"]
      content: sectionLines("Resolve", {
        DNS: serviceEndpoints(this, options(300, 399, 4)),
        FallbackDNS: serviceEndpoints(this, options(100, 199, 4)),
        MulticastDNS: yesno(this.network.multicastDNS),
        ...this.getProperties(filterConfigurable)
      })
    };
  }
}
