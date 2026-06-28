import {
  string_attribute_writable,
  string_collection_attribute_writable,
  boolean_attribute_writable
} from "pacc";
import { Service, addType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

/**
 * @property {string} URL
 * @property {string} ServerCertificateFile
 * @property {string} ServerKeyFile
 */
export class SystemdJournalUploadService extends Service {
  static name = "systemd-journal-upload";
  
  static attributes = {
    URL: { ...string_attribute_writable, name: "URL", configurable: true },
    ServerKeyFile: {
      ...string_attribute_writable,
      name: "ServerKeyFile",
      configurable: true
      // default: "/etc/ssl/private/journal-upload.pem"
    },
    ServerCertificateFile: {
      ...string_attribute_writable,
      name: "ServerCertificateFile",
      configurable: true
      // default: "/etc/ssl/certs/journal-upload.pem"
    },
    TrustedCertificateFile: {
      ...string_attribute_writable,
      name: "TrustedCertificateFile",
      configurable: true
      // default: "/etc/ssl/ca/trusted.pem"
    },
    Compression: {
      ...string_collection_attribute_writable,
      name: "Compression",
      configurable: true
      // default: "zstd lz4 xz"
    },
    ForceCompression: {
      ...boolean_attribute_writable,
      name: "ForceCompression",
      configurable: true
      // default: false
    }
  };
  static service = {
    systemdService: "systemd-journal-upload.service"
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
    console.log(this.fullName, this.owner.fullName);
    console.log(this.property("domainName"), this.name);
    console.log(this.property("certs_private_dir"));
    console.log("PROPS", this.expand(this.getAttributes(filterConfigurable)));
    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/journal-upload.conf.d/${name}.conf`,
      content: sectionLines("Upload", this.getAttributes(filterConfigurable))
    };
  }
}
