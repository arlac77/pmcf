import {
  string_attribute_writable,
  string_set_attribute_writable,
  default_collection_attribute_writable
} from "pacc";
import { Base, addType } from "pmcf";

export class permission extends Base {
  static attributes = {
    pattern: { ...string_attribute_writable, key: true, name: "pattern" },
    user: { ...string_attribute_writable, name: "user" },
    group: { ...string_attribute_writable, name: "group" },
    mode: { ...string_attribute_writable, name: "mode" }
  };
}

export class content extends Base {
  static priority = 1.9;
  static attributes = {
    permissions: {
      ...default_collection_attribute_writable,
      type: permission,
      name: "permissions"
    },
    replaces: { ...string_set_attribute_writable, name: "replaces" },
    depends: { ...string_set_attribute_writable, name: "depends" },
    provides: { ...string_set_attribute_writable, name: "provides" },
    optional: { ...string_set_attribute_writable, name: "optional" }
  };

  static {
    addType(this);
  }

  permissions = new Map();
  _provides = new Set();
  _replaces = new Set();
  _depends = new Set();
  _optional = new Set();

  set provides(value) {
    this._provides = union(value, this._provides);
  }

  get provides() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_provides")
    );
  }

  set replaces(value) {
    this._replaces = union(value, this._replaces);
  }

  get replaces() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_replaces")
    );
  }

  set depends(value) {
    this._depends = union(value, this._depends);
  }

  get depends() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_depends")
    );
  }

  set optional(value) {
    this._optional = union(value, this._optional);
  }

  get optional() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_optional")
    );
  }
}
