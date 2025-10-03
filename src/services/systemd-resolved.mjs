import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints
} from "pmcf";
import { addType } from "../types.mjs";

const SystemdResolvedServiceTypeDefinition = {
  name: "systemd-resolved",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name"
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
      serviceName: "systemd-resolved.service",
      configFileName: `etc/systemd/resolved.conf.d/${name}.conf`,
      content: [
        "Resolve",
        {
          DNS: serviceEndpoints(this, options(300, 399, 4)),
          FallbackDNS: serviceEndpoints(this, options(100, 199, 4)),
          Domains: [...this.localDomains].join(" "),
          DNSSEC: "no",
          MulticastDNS: this.network.multicastDNS ? "yes" : "no",
          LLMNR: "no"
        }
      ]
    };
  }
}
