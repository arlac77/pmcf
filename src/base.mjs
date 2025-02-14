import { join } from "node:path";
import { getAttribute } from "pacc";
import { typesByName } from "./types.mjs";
import { asArray } from "./utils.mjs";

export class Base {
  owner;
  name;
  description;

  static get typeName() {
    return this.typeDefinition.name;
  }

  static get typeDefinition() {
    return {
      name: "base",
      properties: {
        /*   name: { type: "string" },
        description: { type: "string" },
        directory: { type: "string" },
        owner: {}*/
      }
    };
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

    switch (typeof data) {
      case "string":
        this.name = data;
        break;
      case "object": {
        this.name = data.name;
        if (data.description) {
          this.description = data.description;
        }
      }
    }
  }

  read(data) {
    for (const [slotName, typeDef] of Object.entries(
      this.constructor.typeDefinition.properties
    )) {
      const slot = data[slotName];
      if (slot) {
        delete data[slotName];
        if (typeDef.collection) {
          if (Array.isArray(slot) || typeof slot === "string") {
            for (const item of asArray(slot)) {
              new typesByName[typeDef.type](this, item);
            }
          } else {
            for (const [objectName, objectData] of Object.entries(slot)) {
              objectData.name = objectName;
              new typesByName[typeDef.type](this, objectData);
            }
          }
        } else {
         // if (typeDef.type) {
            this[typeDef.type] = new typesByName[typeDef.type](this, slot);
         // }
        }
      }
    }
  }

  forOwner(owner) {
    if (this.owner !== owner) {
      // @ts-ignore
      return new this.constructor(owner, this.toJSON());
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
    return (
      this.#directory ||
      (this.owner ? join(this.owner.directory, this.name) : this.name)
    );
  }

  get fullName() {
    return this.owner?.fullName && this.name
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
    return extractFrom(this);
  }
}

export function extractFrom(object) {
  const json = {};

  for (const p of object?.propertyNames || Object.keys(object)) {
    const value = object[p];

    switch (typeof value) {
      case "undefined":
        break;
      case "object":
        if (value instanceof Base) {
          json[p] = { type: value.typeName };
          if (value.name) {
            json[p].name = value.name;
          }
        } else {
          if (Array.isArray(value)) {
            json[p] = value;
          } else {
            json[p] = Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, extractFrom(v)])
            );
          }
        }
        break;
      default:
        json[p] = value;
    }
  }
  return json;
}
