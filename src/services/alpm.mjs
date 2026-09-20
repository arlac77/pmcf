import {
  default_collection_attribute_writable,
  name_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable
} from "pacc";
import { base } from "../base.mjs";
import { CoreService } from "../core-service.mjs";
import { owner_attribute } from "../common-attributes.mjs";
import { addType } from "../type.mjs";

class alpm_repository extends base {
  static attributes = {
    name: name_attribute_writable,
    base: { ...string_attribute_writable, name: "base" },
    architectures: { ...string_set_attribute_writable, name: "architectures" },
    owner: owner_attribute
  };

  static {
    addType(this);
  }

  architectures = new Set();
}

export class alpm extends CoreService {
  static attributes = {
    repositories: {
      ...default_collection_attribute_writable,
      name: "repositories",
      type: alpm_repository,
      backpointer: owner_attribute
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
