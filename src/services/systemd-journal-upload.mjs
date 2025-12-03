import { string_attribute_writable, addType } from "pacc";
import { Service, ServiceTypeDefinition, addServiceType } from "pmcf";

const SystemdJournalUploadServiceTypeDefinition = {
  name: "systemd-journal-upload",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    url: string_attribute_writable
  }
};

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

  get systemdServices() {
    return this.type;
  }

  systemdConfigs(name) {
    return {
      serviceName: "systemd-journal-upload.service",
      configFileName: `etc/systemd/journal-upload.conf.d/${name}.conf`,
      content: ["Upload", {
        URL : this.url
      }]
    };
  }
}
