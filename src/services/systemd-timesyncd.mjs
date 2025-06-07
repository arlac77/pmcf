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
    return {
      serviceName: "systemd-timesyncd.service",
      configFileName: `etc/systemd/timesyncd.conf.d/${name}.conf`,
      content: [
        "Time",
        {
          NTP: serviceEndpoints(this, {
            services: {
              type: "ntp",
              priority: "[200:399]"
            },
            endpoints: endpoint =>
              endpoint.networkInterface.kind !== "loopback",
            select: endpoint => endpoint.domainName,
            limit: 2,
            join: " "
          })
        }
      ]
    };
  }
}
