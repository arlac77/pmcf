import { FAMILY_IPV4 } from "ip-utilties";
import {
  string_collection_attribute_writable,
  duration_attribute_writable,
  string_attribute_writable,
  boolean_attribute_writable,
  yesno_attribute_writable,
  extract
} from "pacc";
import { ExtraSourceService, serviceEndpoints, addType } from "pmcf";
import {
  SCOPE_SYSTEMD_RESOLVED,
  SOURCES_THIS_EXTENDS
} from "../common-attributes.mjs";
import { yesno, sectionLines } from "../utils.mjs";

export class SystemdResolvedService extends ExtraSourceService {
  static name = "systemd-resolved";
  static attributes = {
    DNS: {
      ...string_attribute_writable,
      name: "DNS",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    FallbackDNS: {
      ...string_attribute_writable,
      name: "FallbackDNS",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    domains: {
      ...string_collection_attribute_writable,
      name: "domains",
      externalName: "Domains",
      scope: SCOPE_SYSTEMD_RESOLVED
      //   sources: SOURCES_THIS_EXTENDS
    },
    MulticastDNS: {
      ...yesno_attribute_writable,
      name: "MulticastDNS",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    Cache: {
      ...boolean_attribute_writable,
      name: "Cache",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    CacheFromLocalhost: {
      ...boolean_attribute_writable,
      name: "CacheFromLocalhost",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    DNSStubListener: {
      ...boolean_attribute_writable,
      name: "DNSStubListener",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    DNSStubListenerExtra: {
      ...string_attribute_writable,
      name: "DNSStubListenerExtra",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    ReadEtcHosts: {
      ...boolean_attribute_writable,
      name: "ReadEtcHosts",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    ResolveUnicastSingleLabel: {
      ...boolean_attribute_writable,
      name: "ResolveUnicastSingleLabel",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    StaleRetentionSec: {
      ...duration_attribute_writable,
      name: "StaleRetentionSec",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    RefuseRecordTypes: {
      ...string_attribute_writable,
      name: "RefuseRecordTypes",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    DNSSEC: {
      ...yesno_attribute_writable,
      name: "DNSSEC",
      default: false,
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    DNSOverTLS: {
      ...yesno_attribute_writable,
      name: "DNSOverTLS",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    },
    LLMNR: {
      ...yesno_attribute_writable,
      name: "LLMNR",
      scope: SCOPE_SYSTEMD_RESOLVED,
      sources: SOURCES_THIS_EXTENDS
    }
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
          e.family === FAMILY_IPV4 &&
          e.networkInterface &&
          e.networkInterface.kind !== "loopback",
        select: endpoint => endpoint.address,
        join: " ",
        limit
      };
    };

    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/resolved.conf.d/${name}.conf`,
      content: sectionLines("Resolve", {
        DNS: serviceEndpoints(this, options(300, 399, 4)),
        FallbackDNS: serviceEndpoints(this, options(100, 199, 4)),
        MulticastDNS: yesno(this.network.multicastDNS),
        ...extract(this, {
          filter: attribute => attribute.scope === SCOPE_SYSTEMD_RESOLVED,
          externalNames: true
        })
      })
    };
  }
}
