import { addType } from "pacc";
import { Service, ServiceTypeDefinition, addServiceType } from "pmcf";

const SystemdJournalRemoteServiceTypeDefinition = {
  name: "systemd-journal-remote",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  service: {
    services: {
      endpoints: [
        {
          family: "IPv4",
          port: 19532,
          protocol: "tcp",
          tls: false
        },
        {
          family: "IPv6",
          port: 19532,
          protocol: "tcp",
          tls: false
        }
      ]
    }
  }
};

export class SystemdJournalRemoteService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return SystemdJournalRemoteServiceTypeDefinition;
  }

  get type() {
    return SystemdJournalRemoteServiceTypeDefinition.name;
  }

  get systemdServices() {
    return this.type;
  }

  systemdConfigs(name) {
    return [
      {
        serviceName: "systemd-journal-remote.service",
        configFileName: `etc/systemd/journal-remote.conf.d/${name}.conf`,
        content: ["Remote", {}]
      } /*,
      {
        serviceName: "systemd-journal-remote.socket"
      }*/
    ];
  }
}
