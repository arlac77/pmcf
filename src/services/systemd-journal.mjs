import { addType } from "pacc";
import { Service, ServiceTypeDefinition } from "pmcf";

const SystemdJournalServiceTypeDefinition = {
  name: "systemd-journal",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name"
};

export class SystemdJournalService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdJournalServiceTypeDefinition;
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
