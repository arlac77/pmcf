import {
  extract,
  string_attribute_writable,
  duration_attribute_writable
} from "pacc";
import { CoreService, addType } from "pmcf";
import { sectionLines } from "../utils.mjs";
import {
  SCOPE_SYSTEMD_JOURNALD,
  SOURCES_THIS_EXTENDS
} from "../common-attributes.mjs";

export class SystemdJournaldService extends CoreService {
  static name = "systemd-journald";
  static attributes = {
    Storage: {
      ...string_attribute_writable,
      name: "Storage",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    Seal: {
      ...string_attribute_writable,
      name: "Seal",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    SplitMode: {
      ...string_attribute_writable,
      name: "SplitMode",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    SyncIntervalSec: {
      ...duration_attribute_writable,
      name: "SyncIntervalSec",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    RateLimitIntervalSec: {
      ...duration_attribute_writable,
      name: "RateLimitIntervalSec",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    RateLimitBurst: {
      ...string_attribute_writable,
      name: "RateLimitBurst",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    SystemMaxUse: {
      ...string_attribute_writable,
      name: "SystemMaxUse",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    SystemKeepFree: {
      ...string_attribute_writable,
      name: "SystemKeepFree",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    SystemMaxFileSize: {
      ...string_attribute_writable,
      name: "SystemMaxFileSize",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    SystemMaxFiles: {
      ...string_attribute_writable,
      name: "SystemMaxFiles",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    RuntimeMaxUse: {
      ...string_attribute_writable,
      name: "RuntimeMaxUse",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    RuntimeKeepFree: {
      ...string_attribute_writable,
      name: "RuntimeKeepFree",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    RuntimeMaxFileSize: {
      ...string_attribute_writable,
      name: "RuntimeMaxFileSize",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    RuntimeMaxFiles: {
      ...string_attribute_writable,
      name: "RuntimeMaxFiles",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    MaxRetentionSec: {
      ...duration_attribute_writable,
      name: "MaxRetentionSec",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    MaxFileSec: {
      ...duration_attribute_writable,
      name: "MaxFileSec",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    ForwardToSyslog: {
      ...string_attribute_writable,
      name: "ForwardToSyslog",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    ForwardToKMsg: {
      ...string_attribute_writable,
      name: "ForwardToKMsg",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    ForwardToConsole: {
      ...string_attribute_writable,
      name: "ForwardToConsole",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    ForwardToWall: {
      ...string_attribute_writable,
      name: "ForwardToWall",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    TTYPath: {
      ...string_attribute_writable,
      name: "TTYPath",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    MaxLevelStore: {
      ...string_attribute_writable,
      name: "MaxLevelStore",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    },
    Compress: {
      ...string_attribute_writable,
      name: "Compress",
      scope: SCOPE_SYSTEMD_JOURNALD,
      sources: SOURCES_THIS_EXTENDS
    }
  };
  static service = {
    systemdService: "systemd-journald.service"
  };
  static {
    addType(this);
  }

  systemdConfigs(name) {
    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/journal.conf.d/${name}.conf`,
      content: sectionLines(
        "Journal",
        extract(this, {
          filter: attribute => attribute.scope === SCOPE_SYSTEMD_JOURNALD,
          externalNames: true
        })
      )
    };
  }
}
