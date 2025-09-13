import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints
} from "pmcf";
import { addType } from "../types.mjs";

const SystemdTimesyncdServiceTypeDefinition = {
  name: "systemd-timesyncd",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  attributes: {},
  service: {}
};

export class SystemdTimesyncdService extends ExtraSourceService {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdTimesyncdServiceTypeDefinition;
  }

  get type() {
    return SystemdTimesyncdServiceTypeDefinition.name;
  }

  get systemdServices() {
    return SystemdTimesyncdServiceTypeDefinition.name;
  }

  systemdConfigs(name) {
    const options = priority => {
      return {
        services: { types: "ntp", priority },
        endpoints: e => e.networkInterface?.kind !== "loopback",
        select: endpoint => endpoint.address,
        join: " ",
        limit: 2
      };
    };

    return {
      serviceName: "systemd-timesyncd.service",
      configFileName: `etc/systemd/timesyncd.conf.d/${name}.conf`,
      content: [
        "Time",
        {
          NTP: serviceEndpoints(this, options("[300:399]")),
          FallbackNTP: serviceEndpoints(this, options("[100:199]"))
        }
      ]
    };
  }
}
