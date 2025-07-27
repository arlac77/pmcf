import { string_attribute } from "pacc";
import { Service, ServiceTypeDefinition } from "pmcf";
import { addType } from "../types.mjs";

const SystemdJournalUploadServiceTypeDefinition = {
  name: "systemd-journal-upload",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {
    url: { ...string_attribute, writable: true }
  },
  service: {}
};

export class SystemdJournalUploadService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return SystemdJournalUploadServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, SystemdJournalUploadServiceTypeDefinition);
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
