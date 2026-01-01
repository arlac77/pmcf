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
    Storage: {
      ...string_attribute_writable
    },
    Seal: {
      ...string_attribute_writable
    },
    SplitMode: {
      ...string_attribute_writable
    },
    SyncIntervalSec: {
      ...duration_attribute_writable
    },
    RateLimitIntervalSec: {
      ...duration_attribute_writable
    },
    RateLimitBurst: {
      ...string_attribute_writable
    },
    SystemMaxUse: {
      ...string_attribute_writable
    },
    SystemKeepFree: {
      ...string_attribute_writable
    },
    SystemMaxFileSize: {
      ...string_attribute_writable
    },
    SystemMaxFiles: {
      ...string_attribute_writable
    },
    RuntimeMaxUse: {
      ...string_attribute_writable
    },
    RuntimeKeepFree: {
      ...string_attribute_writable
    },
    RuntimeMaxFileSize: {
      ...string_attribute_writable
    },
    RuntimeMaxFiles: {
      ...string_attribute_writable
    },
    MaxRetentionSec: {
      ...duration_attribute_writable
    },
    MaxFileSec: {
      ...duration_attribute_writable
    },
    ForwardToSyslog: {
      ...string_attribute_writable
    },
    ForwardToKMsg: {
      ...string_attribute_writable
    },
    ForwardToConsole: {
      ...string_attribute_writable
    },
    ForwardToWall: {
      ...string_attribute_writable
    },
    TTYPath: {
      ...string_attribute_writable
    },
    MaxLevelStore: {
      ...string_attribute_writable
    },
    Compress: {
      ...string_attribute_writable
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
