import { addType } from "pacc";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints
} from "pmcf";

const SystemdTimesyncdServiceTypeDefinition = {
  name: "systemd-timesyncd",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
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
    return this.type;
  }

  systemdConfigs(name) {
    const options = (lower, upper) => {
      return {
        services: `in("ntp",types) && priority >= ${lower} && priority <= ${upper}`,
        endpoints: e =>
          e.networkInterface && e.networkInterface.kind !== "loopback",
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
          NTP: serviceEndpoints(this, options(300, 399)),
          FallbackNTP: serviceEndpoints(this, options(100, 199))
        }
      ]
    };
  }
}
