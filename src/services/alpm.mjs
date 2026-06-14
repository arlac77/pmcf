import {
  default_attribute_writable,
  name_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable
} from "pacc";
import { addType, Service, Base } from "pmcf";

class alpm_repository extends Base {
  static attributes = {
    name: name_attribute_writable,
    base: string_attribute_writable,
    architectures: string_set_attribute_writable
  };

  static {
    addType(this);
  }
}

export class alpm extends Service {
  static specializationOf = Service;
  static attributes = {
    repositories: {
      ...default_attribute_writable,
      type: alpm_repository,
      collection: true
    }
  };

  static service = {
    extends: ["https", "http"]
  };

  static {
    addType(this);
  }

  repositories = new Map();
}
