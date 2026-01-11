import { addType, object_attribute, string_attribute_writable } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const ALPMRepositoryServiceTypeDefinition = {
  name: "alpm-repo",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  attributes: {
    repositories: {
      ...object_attribute,
      collection: true,
      configurable: true,

      attributes: {
        name: string_attribute_writable
      }
    }
  },

  service: {
    extends: ["https"]
  }
};

export class ALPMRepositoryService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return ALPMRepositoryServiceTypeDefinition;
  }

  repositories = {};
}
