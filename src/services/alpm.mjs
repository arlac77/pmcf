import {
  addType,
  default_attribute_writable,
  name_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable
} from "pacc";
import { addServiceType, Base } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const ALPMRepositoryTypeDefinition = {
  name: "alpm_repository",
  extends: Base.typeDefinition,
  key: "name",
  attributes: {
    name: name_attribute_writable,
    base: string_attribute_writable,
    architectures: string_set_attribute_writable
  }
};

class ALPMRepository extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return ALPMRepositoryTypeDefinition;
  }
}

const ALPMServiceTypeDefinition = {
  name: "alpm",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  attributes: {
    repositories: {
      ...default_attribute_writable,
      type: "alpm_repository",
      collection: true
    }
  },

  service: {
    extends: ["https", "http"]
  }
};

export class ALPMService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return ALPMServiceTypeDefinition;
  }

  repositories = new Map();

  typeNamed(type, name) {
    if (type === ALPMRepositoryTypeDefinition.name) {
      return this.repositories.get(name);
    }

    return super.typeNamed(type, name);
  }
}
