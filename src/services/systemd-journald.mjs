import { Service, ServiceTypeDefinition } from "pmcf";
import { addType } from "../types.mjs";

const SystemdJournaldServiceTypeDefinition = {
  name: "systemd-journald",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

export class SystemdJournaldService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdJournaldServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, SystemdJournaldServiceTypeDefinition);
  }

  get type() {
    return SystemdJournaldServiceTypeDefinition.name;
  }

  get systemdServices() {
    return SystemdJournaldServiceTypeDefinition.name;
  }

  systemdConfig(name) {
    return {
      name: `etc/systemd/journal.conf.d/${name}.conf`,
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
