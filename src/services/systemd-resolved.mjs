import { FAMILY_IPV4 } from "ip-utilties";
import {
  string_collection_attribute_writable,
  duration_attribute_writable,
  string_attribute_writable,
  boolean_attribute_writable,
  yesno_attribute_writable
} from "pacc";
import { ExtraSourceService, serviceEndpoints, addType, Service } from "pmcf";
import {
  filterConfigurable,
  yesno,
  sectionLines,
  setionLinesFromPropertyIterator
} from "../utils.mjs";

export class SystemdResolvedService extends ExtraSourceService {
  static name = "systemd-resolved";
  static attributes = {
    DNS: { ...string_attribute_writable, name: "DNS", configurable: true },
    FallbackDNS: {
      ...string_attribute_writable,
      name: "FallbackDNS",
      configurable: true
    },
    domains: {
      ...string_collection_attribute_writable,
      name: "domains",
      externalName: "Domains",
      configurable: true
    },
    MulticastDNS: {
      ...yesno_attribute_writable,
      name: "MulticastDNS",
      configurable: true
    },
    Cache: { ...boolean_attribute_writable, name: "Cache", configurable: true },
    CacheFromLocalhost: {
      ...boolean_attribute_writable,
      name: "CacheFromLocalhost",
      configurable: true
    },
    DNSStubListener: {
      ...boolean_attribute_writable,
      name: "DNSStubListener",
      configurable: true
    },
    DNSStubListenerExtra: {
      ...string_attribute_writable,
      name: "DNSStubListenerExtra",
      configurable: true
    },
    ReadEtcHosts: {
      ...boolean_attribute_writable,
      name: "ReadEtcHosts",
      configurable: true
    },
    ResolveUnicastSingleLabel: {
      ...boolean_attribute_writable,
      name: "ResolveUnicastSingleLabel",
      configurable: true
    },
    StaleRetentionSec: {
      ...duration_attribute_writable,
      name: "StaleRetentionSec",
      configurable: true
    },
    RefuseRecordTypes: {
      ...string_attribute_writable,
      name: "RefuseRecordTypes",
      configurable: true
    },
    DNSSEC: {
      ...yesno_attribute_writable,
      name: "DNSSEC",
      default: false,
      configurable: true
    },
    DNSOverTLS: {
      ...yesno_attribute_writable,
      name: "DNSOverTLS",
      configurable: true
    },
    LLMNR: { ...yesno_attribute_writable, name: "LLMNR", configurable: true }
  };
  static service = {
    extends: ["dns", "mdns", "llmnr"],
    systemdService: "systemd-resolved.service"
  };

  static {
    addType(this);
  }

  systemdConfigs(name) {
    const options = (lower, upper, limit) => {
      return {
        services: `services[types[dns] && priority>=${lower} && priority<=${upper}]`,
        endpoints: e =>
          e.family == FAMILY_IPV4 &&
          e.networkInterface &&
          e.networkInterface.kind !== "loopback",
        //e.family !== "dns",
        select: endpoint => endpoint.address,
        join: " ",
        limit
      };
    };

    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/resolved.conf.d/${name}.conf`,
      //content: [...setionLinesFromPropertyIterator(this.attributeIterator( filterConfigurable)), "A=1"]
      content: sectionLines("Resolve", {
        DNS: serviceEndpoints(this, options(300, 399, 4)),
        FallbackDNS: serviceEndpoints(this, options(100, 199, 4)),
        MulticastDNS: yesno(this.network.multicastDNS),
        ...this.getAttributes(filterConfigurable)
      })
    };
  }
}
