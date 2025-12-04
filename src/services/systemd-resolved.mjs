import { addType, boolean_attribute_writable } from "pacc";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints,
} from "pmcf";
import { yesno } from "../utils.mjs";

const SystemdResolvedServiceTypeDefinition = {
  name: "systemd-resolved",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    dnssec: boolean_attribute_writable,
    llmnr: boolean_attribute_writable
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
          DNSSEC: yesno(this.dnssec),
          MulticastDNS: yesno(this.network.multicastDNS),
          LLMNR: yesno(this.llmnr)
        }
      ]
    };
  }
}
