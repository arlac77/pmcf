import { string_attribute_writable, duration_attribute_writable } from "pacc";
import { Service, addType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

export class SystemdJournaldService extends Service {
  static name = "systemd-journald";
  
  static attributes = {
    Storage: {
      ...string_attribute_writable,
      name: "Storage",
      configurable: true
    },
    Seal: {
      ...string_attribute_writable,
      name: "Seal",
      configurable: true
    },
    SplitMode: {
      ...string_attribute_writable,
      name: "SplitMode",
      configurable: true
    },
    SyncIntervalSec: {
      ...duration_attribute_writable,
      name: "SyncIntervalSec",
      configurable: true
    },
    RateLimitIntervalSec: {
      ...duration_attribute_writable,
      name: "RateLimitIntervalSec",
      configurable: true
    },
    RateLimitBurst: {
      ...string_attribute_writable,
      name: "RateLimitBurst",
      configurable: true
    },
    SystemMaxUse: {
      ...string_attribute_writable,
      name: "SystemMaxUse",
      configurable: true
    },
    SystemKeepFree: {
      ...string_attribute_writable,
      name: "SystemKeepFree",
      configurable: true
    },
    SystemMaxFileSize: {
      ...string_attribute_writable,
      name: "SystemMaxFileSize",
      configurable: true
    },
    SystemMaxFiles: {
      ...string_attribute_writable,
      name: "SystemMaxFiles",
      configurable: true
    },
    RuntimeMaxUse: {
      ...string_attribute_writable,
      name: "RuntimeMaxUse",
      configurable: true
    },
    RuntimeKeepFree: {
      ...string_attribute_writable,
      name: "RuntimeKeepFree",
      configurable: true
    },
    RuntimeMaxFileSize: {
      ...string_attribute_writable,
      name: "RuntimeMaxFileSize",
      configurable: true
    },
    RuntimeMaxFiles: {
      ...string_attribute_writable,
      name: "RuntimeMaxFiles",
      configurable: true
    },
    MaxRetentionSec: {
      ...duration_attribute_writable,
      name: "MaxRetentionSec",
      configurable: true
    },
    MaxFileSec: {
      ...duration_attribute_writable,
      name: "MaxFileSec",
      configurable: true
    },
    ForwardToSyslog: {
      ...string_attribute_writable,
      name: "ForwardToSyslog",
      configurable: true
    },
    ForwardToKMsg: {
      ...string_attribute_writable,
      name: "ForwardToKMsg",
      configurable: true
    },
    ForwardToConsole: {
      ...string_attribute_writable,
      name: "ForwardToConsole",
      configurable: true
    },
    ForwardToWall: {
      ...string_attribute_writable,
      name: "ForwardToWall",
      configurable: true
    },
    TTYPath: {
      ...string_attribute_writable,
      name: "TTYPath",
      configurable: true
    },
    MaxLevelStore: {
      ...string_attribute_writable,
      name: "MaxLevelStore",
      configurable: true
    },
    Compress: {
      ...string_attribute_writable,
      name: "Compress",
      configurable: true
    }
  };
  static service = {
    systemdService: "systemd-journald.service"
  };
  static {
    addType(this);
  }

  get type() {
    return this.constructor.name;
  }

  systemdConfigs(name) {
    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/journal.conf.d/${name}.conf`,
      content: sectionLines("Journal", this.getAttributes(filterConfigurable))
    };
  }
}
