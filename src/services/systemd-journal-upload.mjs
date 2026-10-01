import {
  extract,
  string_attribute_writable,
  string_collection_attribute_writable,
  boolean_attribute_writable
} from "pacc";
import { CoreService, addType } from "pmcf";
import { sectionLines } from "../utils.mjs";
import {
  SCOPE_SYSTEMD_JOURNAL_UPLOAD,
  SOURCES_THIS_EXTENDS
} from "../common-attributes.mjs";

/**
 * @property {string} URL
 * @property {string} ServerCertificateFile
 * @property {string} ServerKeyFile
 */
export class SystemdJournalUploadService extends CoreService {
  static name = "systemd-journal-upload";
  static attributes = {
    URL: {
      ...string_attribute_writable,
      name: "URL",
      scope: SCOPE_SYSTEMD_JOURNAL_UPLOAD,
      sources: SOURCES_THIS_EXTENDS
    },
    ServerKeyFile: {
      ...string_attribute_writable,
      name: "ServerKeyFile",
      scope: SCOPE_SYSTEMD_JOURNAL_UPLOAD,
      sources: SOURCES_THIS_EXTENDS
      // default: "/etc/ssl/private/journal-upload.pem"
    },
    ServerCertificateFile: {
      ...string_attribute_writable,
      name: "ServerCertificateFile",
      scope: SCOPE_SYSTEMD_JOURNAL_UPLOAD,
      sources: SOURCES_THIS_EXTENDS
      // default: "/etc/ssl/certs/journal-upload.pem"
    },
    TrustedCertificateFile: {
      ...string_attribute_writable,
      name: "TrustedCertificateFile",
      scope: SCOPE_SYSTEMD_JOURNAL_UPLOAD,
      sources: SOURCES_THIS_EXTENDS
      // default: "/etc/ssl/ca/trusted.pem"
    },
    Compression: {
      ...string_collection_attribute_writable,
      name: "Compression",
      scope: SCOPE_SYSTEMD_JOURNAL_UPLOAD,
      sources: SOURCES_THIS_EXTENDS
      // default: "zstd lz4 xz"
    },
    ForceCompression: {
      ...boolean_attribute_writable,
      name: "ForceCompression",
      scope: SCOPE_SYSTEMD_JOURNAL_UPLOAD,
      sources: SOURCES_THIS_EXTENDS
      // default: false
    }
  };
  static service = {
    systemdService: "systemd-journal-upload.service"
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
    /*
    console.log(this.fullName, this.owner.fullName);
    console.log(this.property("domainName"), this.name);
    console.log(this.property("certs_private_dir"));
    */
    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/journal-upload.conf.d/${name}.conf`,
      content: sectionLines(
        "Upload",
        extract(this, {
          filter: attribute => attribute.scope === SCOPE_SYSTEMD_JOURNAL_UPLOAD,
          externalNames: true
        })
      )
    };
  }
}
