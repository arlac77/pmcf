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
  properties: {}
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

  systemdConfig(name) {
    const options = priority => {
      return {
        services: { type: "dns", priority },
        endpoints: e => e.networkInterface.kind !== "loopback",
        select: endpoint => endpoint.address,
        join: " ",
        limit: 5
      };
    };

    return {
      name: `etc/systemd/resolved.conf.d/${name}.conf`,
      content: [
        "Resolve",
        {
          DNS: serviceEndpoints(this, options("<10")),
          FallbackDNS: serviceEndpoints(this, options(">=20")),
          Domains: [...this.localDomains].join(" "),
          DNSSEC: "no",
          MulticastDNS: this.network.multicastDNS ? "yes" : "no",
          LLMNR: "no"
        }
      ]
    };
  }
}
