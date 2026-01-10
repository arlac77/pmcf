import {
  string_attribute_writable,
  boolean_attribute_writable,
  addType
} from "pacc";
import { Service, ServiceTypeDefinition, addServiceType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

const SystemdJournalUploadServiceTypeDefinition = {
  name: "systemd-journal-upload",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    URL: { ...string_attribute_writable, configurable: true },
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
    Compression: {
      ...string_attribute_writable,
      configurable: true
      //   default: "zstd lz4 xz"
    },
    ForceCompression: {
      ...boolean_attribute_writable,
      configurable: true
      //   default: false
    }
  },
  service: {
    systemdService: "systemd-journal-upload.service"
  }
};

/**
 * @property {string} URL
 * @property {string} ServerCertificateFile
 * @property {string} ServerKeyFile
 */
export class SystemdJournalUploadService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return SystemdJournalUploadServiceTypeDefinition;
  }

  get type() {
    return SystemdJournalUploadServiceTypeDefinition.name;
  }

  /**
   *
   * @param {string} name
   * @returns {Object}
   */
  systemdConfigs(name) {
    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/journal-upload.conf.d/${name}.conf`,
      content: sectionLines("Upload", this.getProperties(filterConfigurable))
    };
  }
}
