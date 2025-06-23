import {
  ExtraSourceService,
  ServiceTypeDefinition,
  serviceEndpoints
} from "pmcf";
import { addType } from "../types.mjs";

const SystemdTimesyncdServiceTypeDefinition = {
  name: "systemd-timesyncd",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {},
  service: {}
};

export class SystemdTimesyncdService extends ExtraSourceService {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdTimesyncdServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, SystemdTimesyncdServiceTypeDefinition);
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
