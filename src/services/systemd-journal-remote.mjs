import { getAttributesJSON, addType, string_attribute_writable } from "pacc";
import { Service, ServiceTypeDefinition, addServiceType } from "pmcf";

const SystemdJournalRemoteServiceTypeDefinition = {
  name: "systemd-journal-remote",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    ServerCertificateFile: string_attribute_writable,
    ServerKeyFile: string_attribute_writable
  },

  service: {
    services: {
      endpoints: [
        {
          family: "IPv4",
          port: 19532,
          protocol: "tcp",
          tls: false
        },
        {
          family: "IPv6",
          port: 19532,
          protocol: "tcp",
          tls: false
        }
      ]
    }
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

  get systemdServices() {
    return this.type;
  }

  /**
   *
   * @param {string} name
   * @returns {Object}
   */
  systemdConfigs(name) {
    return [
      {
        serviceName: "systemd-journal-remote.service",
        configFileName: `etc/systemd/journal-remote.conf.d/${name}.conf`,
        content: [
          "Remote",
          getAttributesJSON(
            this,
            SystemdJournalRemoteServiceTypeDefinition.attributes
          )
        ]
      } /*,
      {
        serviceName: "systemd-journal-remote.socket"
      }*/
    ];
  }
}
