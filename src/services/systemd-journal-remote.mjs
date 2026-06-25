import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import {
  string_attribute_writable,
  string_collection_attribute_writable,
  boolean_attribute_writable,
  integer_attribute_writable
} from "pacc";
import { Service, addType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

/**
 * @property {string} ServerCertificateFile
 * @property {string} ServerKeyFile
 */
export class SystemdJournalRemoteService extends Service {
  static name = "systemd-journal-remote";
  static specializationOf = Service;
  static attributes = {
    Seal: {
      ...boolean_attribute_writable,
      name: "Seal",
      configurable: true
    },
    SplitMode: {
      ...string_attribute_writable,
      name: "SplitMode",
      values: [false, "host"],
      configurable: true
    },
    ServerKeyFile: {
      ...string_attribute_writable,
      name: "ServerKeyFile",
      configurable: true
      //   default: "/etc/ssl/private/journal-upload.pem"
    },
    ServerCertificateFile: {
      ...string_attribute_writable,
      name: "ServerCertificateFile",
      configurable: true
      //   default: "/etc/ssl/certs/journal-upload.pem"
    },
    TrustedCertificateFile: {
      ...string_attribute_writable,
      name: "TrustedCertificateFile",
      configurable: true
      //  default: "/etc/ssl/ca/trusted.pem"
    },
    MaxUse: {
      ...string_attribute_writable,
      name: "MaxUse",
      configurable: true
    },
    KeepFree: {
      ...string_attribute_writable,
      name: "KeepFree",
      configurable: true
    },
    MaxFileSize: {
      ...string_attribute_writable,
      name: "MaxFileSize",
      configurable: true
    },
    MaxFiles: {
      ...integer_attribute_writable,
      name: "MaxFiles",
      configurable: true
    },
    Compression: {
      ...string_collection_attribute_writable,
      name: "Compression",
      configurable: true
      //   default: "zstd lz4 xz"
    }
  };
  static service = {
    systemdService: "systemd-journal-remote.service",
    endpoints: [
      {
        family: FAMILY_IPV4,
        port: 19532,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      },
      {
        family: FAMILY_IPV6,
        port: 19532,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      }
    ]
  };

  static {
    addType(this);
  }

  get type() {
    return this.constructor.name;
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
      content: sectionLines("Remote", this.getAttributes(filterConfigurable))
    };
  }
}
