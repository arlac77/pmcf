import { ExtraSourceService, ServiceTypeDefinition } from "pmcf";
import { serviceAddresses } from "../service.mjs";
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
    return {
      name: `etc/systemd/resolved.conf.d/${name}.conf`,
      content: [
        "Resolve",
        {
          DNS: serviceAddresses(this, {
            type: "dns",
            priority: "<10"
          }).join(" "),
          FallbackDNS: serviceAddresses(this, {
            type: "dns",
            priority: ">=10"
          }).join(" "),
          Domains: [...this.localDomains].join(" "),
          DNSSEC: "no",
          MulticastDNS: this.network.multicastDNS ? "yes" : "no",
          LLMNR: "no"
        }
      ]
    };
  }
}
