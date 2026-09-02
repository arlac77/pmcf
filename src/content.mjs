import path, { join } from "node:path";
import {
  name_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable,
  default_collection_attribute_writable,
  description_attribute_writable,
  extendingAttributeIterator
} from "pacc";
import { allOutputs } from "npm-pkgbuild";
import { core, addType } from "pmcf";
import { union } from "./utils.mjs";
import { loadHooks } from "./hooks.mjs";

export class permission extends core {
  static key = "pattern";
  static attributes = {
    pattern: { ...string_attribute_writable, key: true, name: "pattern" },
    user: { ...string_attribute_writable, name: "user" },
    group: { ...string_attribute_writable, name: "group" },
    mode: { ...string_attribute_writable, name: "mode" }
  };

  static {
    addType(this);
  }

  get fullName() {
    return this.pattern;
  }
}

export class content extends core {
  static attributes = {
    name: { ...name_attribute_writable, packagingProperty: true },
    description: { ...description_attribute_writable, packagingProperty: true },
    permissions: {
      ...default_collection_attribute_writable,
      type: permission,
      name: "permissions"
    },
    access: {
      ...string_attribute_writable,
      name: "access",
      default: "private",
      packagingProperty: true
    },
    depends: {
      ...string_set_attribute_writable,
      name: "depends",
      packagingProperty: true
    },
    provides: {
      ...string_set_attribute_writable,
      name: "provides",
      packagingProperty: true
    },
    replaces: {
      ...string_set_attribute_writable,
      name: "replaces",
      packagingProperty: true
    },
    optional: {
      ...string_set_attribute_writable,
      name: "optional",
      packagingProperty: true
    },
    groups: {
      ...string_set_attribute_writable,
      name: "groups",
      packagingProperty: true
    },
    backup: {
      ...string_set_attribute_writable,
      name: "backup",
      packagingProperty: true
    },
    hooks: {
      ...string_set_attribute_writable,
      name: "hooks",
      packagingProperty: true
    },
    packaging: { ...string_set_attribute_writable, name: "packaging" }
  };

  static {
    addType(this);
  }

  _permissions = new Map();
  _packaging = new Set();
  _provides = new Set();
  _replaces = new Set();
  _depends = new Set();
  _optional = new Set();
  _groups = new Set();
  _hooks = new Set();

  get host() {
    return this.owner.host;
  }

  value(name) {
    return super.value(name) ?? this.owner.value(name);
  }

  get name() {
    let name = this.attribute("_name");
    if (name !== undefined) {
      return name;
    }

    const node = this.owner;
    const nameParts = [node.typeName, node.owner?.name, node.name];
    return nameParts.filter(n => n !== undefined && n.length > 0).join("-");
  }

  set name(value) {
    this._name = value;
  }

  get fullName() {
    return this.name;
  }

  get description() {
    let description = this.attribute("_description");
    if (description !== undefined) {
      return description;
    }

    const node = this.owner;
    return `${node.typeName} definitions for ${node.fullName}`;
  }

  set description(value) {
    this._description = value;
  }

  /**
   * @return {string}
   */
  get access() {
    return this.attribute("_access");
  }

  set access(value) {
    this._access = value;
  }

  set packaging(value) {
    this._packaging = union(value, this._packaging);
  }

  get packaging() {
    const all = this.unionFromDirections(["this", "extends"], "_packaging");
    if (all.size === 0) {
      const content = this.host.content;
      if (content && content !== this) {
        return content.packaging;
      }
    }
    return all;
  }

  get outputs() {
    return new Set(allOutputs.filter(o => this.packaging.has(o.name)));
  }

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

  set groups(value) {
    this._groups = union(value, this._groups);
  }

  get groups() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_groups")
    );
  }

  set backup(value) {
    this._backup = union(value, this._backup);
  }

  get backup() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_backup")
    );
  }

  set hooks(value) {
    this._hooks = union(value, this._hooks);
  }

  get hooks() {
    return this.expand(this.unionFromDirections(["this", "extends"], "_hooks"));
  }

  get permissions() {
    return this.mapFromDirections(["this", "extends"], "_permissions");
  }

  /**
   *
   * @param {object} packageData
   */
  async loadHooks(packageData) {
    for (const node of this.walkDirections(["this", "extends"])) {
      for (const hook of node._hooks) {
        await loadHooks(packageData, join(node.owner.directory, hook));
      }
    }
  }

  async packageData(node) {
    const packageData = {
      sources: [],
      outputs: this.outputs,
      properties: Object.fromEntries(
        extendingAttributeIterator(
          this.constructor,
          attribute => attribute.packagingProperty
        ).map(([path, attribute]) => [path[0], this[path[0]]])
      )
    };

    await this.loadHooks(packageData);

    return packageData;
  }
}
