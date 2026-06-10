import {
  addType,
  default_attribute_writable,
  name_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable
} from "pacc";
import { addServiceType, Base } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

class ALPMRepository extends Base {
  static name = "alpm_repository";
  static extends = Base.typeDefinition;
  static key = "name";
  static attributes = {
    name: name_attribute_writable,
    base: string_attribute_writable,
    architectures: string_set_attribute_writable
  };

  static typeDefinition = this;
  static {
    addType(this);
  }
}

export class ALPMService extends Service {
  static name = "alpm";
  static priority = 1;
  static extends = ServiceTypeDefinition;
  static specializationOf = ServiceTypeDefinition;
  static owners = ServiceTypeDefinition.owners;
  static attributes = {
    repositories: {
      ...default_attribute_writable,
      type: "alpm_repository",
      collection: true
    }
  };

  static service = {
    extends: ["https", "http"]
  };

  static typeDefinition = this;
  static {
    addType(this);
    addServiceType(this.service, this.name);
  }

  repositories = new Map();

  typeNamed(type, name) {
    if (type === ALPMService.name) {
      return this.repositories.get(name);
    }

    return super.typeNamed(type, name);
  }
}
