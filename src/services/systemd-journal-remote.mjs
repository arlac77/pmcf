import {
  extract,
  string_attribute_writable,
  string_collection_attribute_writable,
  boolean_attribute_writable,
  integer_attribute_writable
} from "pacc";
import { CoreService, addType } from "pmcf";
import { sectionLines } from "../utils.mjs";
import { FAMILY_IPV4_IPV6, PROTOCOL_TCP } from "../constants.mjs";
import {
  SCOPE_SYSTEMD_JOURNAL_REMOTE,
  SOURCES_THIS_EXTENDS
} from "../common-attributes.mjs";

/**
 * @property {string} ServerCertificateFile
 * @property {string} ServerKeyFile
 */
export class SystemdJournalRemoteService extends CoreService {
  static name = "systemd-journal-remote";
  static attributes = {
    Seal: {
      ...boolean_attribute_writable,
      name: "Seal",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
    },
    SplitMode: {
      ...string_attribute_writable,
      name: "SplitMode",
      values: new Set([false, "host"]),
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
    },
    ServerKeyFile: {
      ...string_attribute_writable,
      name: "ServerKeyFile",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
      //   default: "/etc/ssl/private/journal-upload.pem"
    },
    ServerCertificateFile: {
      ...string_attribute_writable,
      name: "ServerCertificateFile",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
      //   default: "/etc/ssl/certs/journal-upload.pem"
    },
    TrustedCertificateFile: {
      ...string_attribute_writable,
      name: "TrustedCertificateFile",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
      //  default: "/etc/ssl/ca/trusted.pem"
    },
    MaxUse: {
      ...string_attribute_writable,
      name: "MaxUse",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
    },
    KeepFree: {
      ...string_attribute_writable,
      name: "KeepFree",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
    },
    MaxFileSize: {
      ...string_attribute_writable,
      name: "MaxFileSize",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
    },
    MaxFiles: {
      ...integer_attribute_writable,
      name: "MaxFiles",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
    },
    Compression: {
      ...string_collection_attribute_writable,
      name: "Compression",
      scope: SCOPE_SYSTEMD_JOURNAL_REMOTE,
      sources: SOURCES_THIS_EXTENDS
      //   default: "zstd lz4 xz"
    }
  };
  static service = {
    systemdService: "systemd-journal-remote.service",
    //extends: ["http"],
    endpoints: [
      {
        family: FAMILY_IPV4_IPV6,
        port: 19532,
        protocol: PROTOCOL_TCP,
        tls: false,
        pathname: "/"
      }
    ]
  };

  static {
    addType(this);
  }

  /**
   *
   * @param {string} name
   * @returns {Object}
   */
  systemdConfigs(name) {
    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/journal-remote.conf.d/${name}.conf`,
      content: sectionLines(
        "Remote",
        extract(this, {
          filter: attribute => attribute.scope === SCOPE_SYSTEMD_JOURNAL_REMOTE,
          externalNames: true
        })
      )
    };
  }
}
