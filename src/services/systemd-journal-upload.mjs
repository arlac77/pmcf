import { Service, ServiceTypeDefinition } from "pmcf";
import { addType } from "../types.mjs";

const SystemdJournalUploadServiceTypeDefinition = {
  name: "systemd-journal-upload",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
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

  systemdConfig(name) {
    return {
      serviceName: "systemd-journal-upload",
      configFileName: `etc/systemd/journal-upload.conf.d/${name}.conf`,
      content: ["Upload", {
        URL : ""
      }]
    };
  }
}
