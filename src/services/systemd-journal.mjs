import { Service, ServiceTypeDefinition } from "pmcf";
import { addType } from "../types.mjs";

const SystemdJournalServiceTypeDefinition = {
  name: "systemd-journal",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

export class SystemdJournalService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdJournalServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, SystemdJournalServiceTypeDefinition);
  }

  get type() {
    return SystemdJournalServiceTypeDefinition.name;
  }

  get systemdServices() {
    return SystemdJournalServiceTypeDefinition.name;
  }

  systemdConfigs(name) {
    return {
      serviceName: "systemd-journald",  
      configFileName: `etc/systemd/journal.conf.d/${name}.conf`,
      content: [
        "Journal",
        {
          Compress: "yes",
          SystemMaxUse: "500M",
          SyncIntervalSec: "15m"
        }
      ]
    };
  }
}
