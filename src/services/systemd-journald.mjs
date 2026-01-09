import {
  addType,
  string_attribute_writable,
  duration_attribute_writable
} from "pacc";
import { Service, ServiceTypeDefinition, addServiceType } from "pmcf";
import { filterConfigurable } from "../utils.mjs";

const SystemdJournalServiceTypeDefinition = {
  name: "systemd-journald",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    Storage: {
      ...string_attribute_writable,
      configurable: true
    },
    Seal: {
      ...string_attribute_writable,
      configurable: true
    },
    SplitMode: {
      ...string_attribute_writable,
      configurable: true
    },
    SyncIntervalSec: {
      ...duration_attribute_writable,
      configurable: true
    },
    RateLimitIntervalSec: {
      ...duration_attribute_writable,
      configurable: true
    },
    RateLimitBurst: {
      ...string_attribute_writable,
      configurable: true
    },
    SystemMaxUse: {
      ...string_attribute_writable,
      configurable: true
    },
    SystemKeepFree: {
      ...string_attribute_writable,
      configurable: true
    },
    SystemMaxFileSize: {
      ...string_attribute_writable,
      configurable: true
    },
    SystemMaxFiles: {
      ...string_attribute_writable,
      configurable: true
    },
    RuntimeMaxUse: {
      ...string_attribute_writable,
      configurable: true
    },
    RuntimeKeepFree: {
      ...string_attribute_writable,
      configurable: true
    },
    RuntimeMaxFileSize: {
      ...string_attribute_writable,
      configurable: true
    },
    RuntimeMaxFiles: {
      ...string_attribute_writable,
      configurable: true
    },
    MaxRetentionSec: {
      ...duration_attribute_writable,
      configurable: true
    },
    MaxFileSec: {
      ...duration_attribute_writable,
      configurable: true
    },
    ForwardToSyslog: {
      ...string_attribute_writable,
      configurable: true
    },
    ForwardToKMsg: {
      ...string_attribute_writable,
      configurable: true
    },
    ForwardToConsole: {
      ...string_attribute_writable,
      configurable: true
    },
    ForwardToWall: {
      ...string_attribute_writable,
      configurable: true
    },
    TTYPath: {
      ...string_attribute_writable,
      configurable: true
    },
    MaxLevelStore: {
      ...string_attribute_writable,
      configurable: true
    },
    Compress: {
      ...string_attribute_writable,
      configurable: true
    }
  },
  service: {}
};

export class SystemdJournaldService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
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
      serviceName: `${this.type}.service`,
      configFileName: `etc/systemd/journal.conf.d/${name}.conf`,
      content: ["Journal", this.getProperties(filterConfigurable)]
    };
  }
}
