import {
  addType,
  string_attribute_writable,
  string_collection_attribute_writable,
  boolean_attribute_writable,
  integer_attribute_writable
} from "pacc";
import { Service, ServiceTypeDefinition, addServiceType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

const SystemdJournalRemoteServiceTypeDefinition = {
  name: "systemd-journal-remote",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    Seal: {
      ...boolean_attribute_writable,
      configurable: true
    },
    SplitMode: {
      ...string_attribute_writable,
      values: [false, "host"],
      configurable: true
    },
    ServerKeyFile: {
      ...string_attribute_writable,
      configurable: true
      //   default: "/etc/ssl/private/journal-upload.pem"
    },
    ServerCertificateFile: {
      ...string_attribute_writable,
      configurable: true
      //   default: "/etc/ssl/certs/journal-upload.pem"
    },
    TrustedCertificateFile: {
      ...string_attribute_writable,
      configurable: true
      //  default: "/etc/ssl/ca/trusted.pem"
    },
    MaxUse: {
      ...string_attribute_writable,
      configurable: true
    },
    KeepFree: {
      ...string_attribute_writable,
      configurable: true
    },
    MaxFileSize: {
      ...string_attribute_writable,
      configurable: true
    },
    MaxFiles: {
      ...integer_attribute_writable,
      configurable: true
    },
    Compression: {
      ...string_collection_attribute_writable,
      configurable: true
      //   default: "zstd lz4 xz"
    }
  },
  service: {
    systemdService: "systemd-journal-remote.service",
    endpoints: [
      {
        family: "IPv4",
        port: 19532,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      },
      {
        family: "IPv6",
        port: 19532,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      }
    ]
  }
};

/**
 * @property {string} ServerCertificateFile
 * @property {string} ServerKeyFile
 */
export class SystemdJournalRemoteService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return SystemdJournalRemoteServiceTypeDefinition;
  }

  get type() {
    return SystemdJournalRemoteServiceTypeDefinition.name;
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
      content: sectionLines("Remote", this.getProperties(filterConfigurable))
    };
  }
}
