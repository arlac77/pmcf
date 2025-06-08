import {
  ExtraSourceService,
  ServiceTypeDefinition,
  serviceEndpoints
} from "pmcf";
import { addType } from "../types.mjs";

const SystemdResolvedServiceTypeDefinition = {
  name: "systemd-resolved",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {},
  service: {}
};

export class SystemdResolvedService extends ExtraSourceService {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdResolvedServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, SystemdResolvedServiceTypeDefinition);
  }

  get type() {
    return SystemdResolvedServiceTypeDefinition.name;
  }

  get systemdServices() {
    return SystemdResolvedServiceTypeDefinition.name;
  }

  systemdConfigs(name) {
    const options = (priority, limit) => {
      return {
        services: { types: "dns", priority },
        endpoints: e =>
          e.networkInterface.kind !== "loopback" && e.family !== "dns",
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
          DNS: serviceEndpoints(this, options("[300:399]", 4)),
          FallbackDNS: serviceEndpoints(this, options("[100:199]", 4)),
          Domains: [...this.localDomains].join(" "),
          DNSSEC: "no",
          MulticastDNS: this.network.multicastDNS ? "yes" : "no",
          LLMNR: "no"
        }
      ]
    };
  }
}
