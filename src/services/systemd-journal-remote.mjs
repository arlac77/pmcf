import { Service, ServiceTypeDefinition } from "pmcf";
import { addType } from "../types.mjs";
import { addServiceTypes } from "../service-types.mjs";

const SystemdJournalRemoteServiceTypeDefinition = {
  name: "systemd-journal-remote",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

const SystemdJournalRemoteServiceTypes = {
  [SystemdJournalRemoteServiceTypeDefinition.name]: {
    extends: ["http"],
    endpoints: [
      {
        port: 19532,
        protocol: "tcp",
        tls: false
      }
    ]
  }
};

export class SystemdJournalRemoteService extends Service {
  static {
    addType(this);
    addServiceTypes(SystemdJournalRemoteServiceTypes);
  }

  static get typeDefinition() {
    return SystemdJournalRemoteServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, SystemdJournalRemoteServiceTypeDefinition);
  }

  get type() {
    return SystemdJournalRemoteServiceTypeDefinition.name;
  }

  get systemdServices() {
    return SystemdJournalRemoteServiceTypeDefinition.name;
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
