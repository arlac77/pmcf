import {
  addType,
  string_attribute_writable,
  duration_attribute_writable
} from "pacc";
import { Service, addServiceType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

export class SystemdJournaldService extends Service {
  static name = "systemd-journald";
  static priority = 1;
  static extends = Service;
  static specializationOf = Service;
  static owners = Service.owners;
  static key = "name";
  static attributes = {
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
  };
  static service = {
    systemdService: "systemd-journald.service"
  };
  static {
    addType(this);
    addServiceType(this.service, this.name);
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
