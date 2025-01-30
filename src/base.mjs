import { join } from "node:path";
import { getAttribute } from "pacc";

export class Base {
  owner;
  name;
  description;

  static get typeName() {
    return "base";
  }

  static get pluralTypeName() {
    return this.typeName + "s";
  }

  static get nameLookupName() {
    return this.typeName + "Named";
  }

  static get typeFileName() {
    return this.typeName + ".json";
  }

  static get fileNameGlob() {
    return "**/" + this.typeFileName;
  }

  static async prepareData(root, data) {
    return this;
  }

  static normalizeName(name) {
    if (name !== undefined) {
      return name.replace(/\/\w+\.json$/, "");
    }
  }

  constructor(owner, data) {
    this.owner = owner;

    if (data) {
      this.name = data.name;
      if (data.description) {
        this.description = data.description;
      }
    }
  }

  withOwner(owner) {
    if (this.owner !== owner) {
      // @ts-ignore
      return new this.constructor(owner, this);
    }

    return this;
  }

  get typeName() {
    // @ts-ignore
    return this.constructor.typeName;
  }

  get root() {
    return this.owner.root;
  }

  get location() {
    return this.owner?.location;
  }

  get host() {
    return this.owner?.host;
  }

  get network() {
    return this.owner?.network;
  }

  get administratorEmail() {
    return this.owner?.administratorEmail;
  }

  #directory;
  set directory(directory) {
    this.#directory = directory;
  }

  get directory() {
    return this.#directory || join(this.owner.directory, this.name);
  }

  get fullName() {
    return this.owner && this.name
      ? join(this.owner.fullName, this.name)
      : this.name;
  }

  expand(object) {
    switch (typeof object) {
      case "string":
        return object.replaceAll(/\$\{([^\}]*)\}/g, (match, m1) => {
          return getAttribute(this, m1) || "${" + m1 + "}";
        });

      case "object":
        if (Array.isArray(object)) {
          return object.map(e => this.expand(e));
        }

        if (object instanceof Set) {
          return new Set([...object].map(e => this.expand(e)));
        }

        /*return Object.fromEntries(
          Object.entries(object).map(([k, v]) => [k, this.expand(v)])
        );*/
    }

    return object;
  }

  #finalize;

  finalize(action) {
    if (!this.#finalize) {
      this.#finalize = [];
    }
    this.#finalize.push(action);
  }

  execFinalize() {
    this.traverse(object => object._finalize());
  }

  _finalize() {
    if (this.#finalize) {
      let i = 0;
      for (const action of this.#finalize) {
        if (action) {
          this.#finalize[i] = undefined;
          action();
        }
        i++;
      }
    }
  }

  traverse(visitor, ...args) {
    const visited = new Set();
    this._traverse(visited, visitor, ...args);
  }

  _traverse(visited, visitor, ...args) {
    if (visited.has(this)) {
      return false;
    }

    visited.add(this);

    visitor(this, ...args);

    return true;
  }

  error(...args) {
    console.error(`${this.toString()}:`, ...args);
  }

  info(...args) {
    console.info(`${this.toString()}:`, ...args);
  }

  toString() {
    return `${this.fullName}(${this.typeName})`;
  }

  get propertyNames() {
    return ["name", "description", "directory", "owner"];
  }

  toJSON() {
    return extractFrom(this, this.propertyNames);
  }
}

export function extractFrom(object, propertyNames) {
  const json = {};
  for (const p of propertyNames) {
    const value = object[p];

    if (value !== undefined) {
      if (value instanceof Base && value.name !== undefined) {
        json[p] = { name: value.name };
      } else {
        json[p] = value;
      }
    }
  }
  return json;
}
