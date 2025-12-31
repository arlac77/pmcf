import {
  addType,
  getAttributesJSON,
  string_attribute_writable,
  duration_attribute_writable
} from "pacc";
import { Service, ServiceTypeDefinition } from "pmcf";

const SystemdJournalServiceTypeDefinition = {
  name: "systemd-journal",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    Compress: {
      ...string_attribute_writable
    },
    SystemMaxUse: {
      ...string_attribute_writable
    },
    SyncIntervalSec: {
      ...duration_attribute_writable
    }
  }
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
    return this.type;
  }

  systemdConfigs(name) {
    return {
      serviceName: "systemd-journald",
      configFileName: `etc/systemd/journal.conf.d/${name}.conf`,
      content: [
        "Journal",
        getAttributesJSON(this, SystemdJournalServiceTypeDefinition.attributes)
      ]
    };
  }
}
