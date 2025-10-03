import { string_attribute_writable } from "pacc";
import { Service, ServiceTypeDefinition } from "pmcf";
import { addType } from "../types.mjs";

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
  }

  static get typeDefinition() {
    return SystemdJournalUploadServiceTypeDefinition;
  }

  get type() {
    return SystemdJournalUploadServiceTypeDefinition.name;
  }

  get systemdServices() {
    return SystemdJournalUploadServiceTypeDefinition.name;
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
