import { Service, ServiceTypeDefinition } from "pmcf";
import { serviceAddresses } from "../service.mjs";

import { addType } from "../types.mjs";

const SystemdTimesyncdServiceTypeDefinition = {
  name: "systemd-timesyncd",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

export class SystemdTimesyncdService extends Service {
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

  systemdConfig(name) {
    return {
      name: `etc/systemd/timesyncd.conf.d/${name}.conf`,
      content: [
        "Time",
        {
          NTP: serviceAddresses(
            this,
            {
              type: "ntp",
              priority: "<20"
            },
            "domainName",
            () => true
          ).join(" ")
        }
      ]
    };
  }
}
