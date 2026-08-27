import {
  name_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable,
  default_collection_attribute_writable
} from "pacc";
import { allOutputs } from "npm-pkgbuild";
import { core, addType } from "pmcf";
import { union } from "./utils.mjs";
import { loadHooks } from "./hooks.mjs";

export class permission extends core {
  static priority = 1.9;
  static attributes = {
    pattern: { ...string_attribute_writable, key: true, name: "pattern" },
    user: { ...string_attribute_writable, name: "user" },
    group: { ...string_attribute_writable, name: "group" },
    mode: { ...string_attribute_writable, name: "mode" }
  };

  static {
    addType(this);
  }

  get name() {
    return this.pattern;
  }
}

export class content extends core {
  static priority = 1.9;
  static attributes = {
    name: name_attribute_writable,
    permissions: {
      ...default_collection_attribute_writable,
      type: permission,
      name: "permissions"
    },
    access: {
      ...string_attribute_writable,
      name: "access",
      default: "private"
    },
    depends: { ...string_set_attribute_writable, name: "depends" },
    provides: { ...string_set_attribute_writable, name: "provides" },
    replaces: { ...string_set_attribute_writable, name: "replaces" },
    optional: { ...string_set_attribute_writable, name: "optional" },
    groups: { ...string_set_attribute_writable, name: "groups" },
    backup: { ...string_set_attribute_writable, name: "backup" },
    hooks: { ...string_set_attribute_writable, name: "hooks" },
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

  value(name) {
    //  console.log("CONTENT VALUE", this.name, this.owner.fullName, name, this.owner.name);
    return this.owner.value(name) ?? super.value(name);
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
    return this.unionFromDirections(["this", "extends"], "_packaging");
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
    const p = this.mapFromDirections(["this", "extends"], "_permissions");

    return p;

    /*
    const owner = this.systemUserName;
    const group = this.systemGroupName;
    return [
      {
        mode: 0o644,
        owner,
        group
      },
      {
        mode: 0o755,
        owner,
        group
      }
    ];
*/
  }

  async packageData(node) {
    const packageData = {
      sources: [],
      outputs: this.outputs,
      properties: {
        name: this.name,
        description: `${node.typeName} definitions for ${node.fullName}`,
        access: this.access,
        groups: [...this.groups],
        depends: [...this.depends],
        provides: [...this.provides],
        replaces: [...this.replaces],
        optional: [...this.optional],
        backup: [...this.backup]
      }
    };

    for (const hook of this.hooks) {
      await loadHooks(
        packageData,
        new URL("host.install", import.meta.url).pathname
      );
    }

    return packageData;
  }
}
