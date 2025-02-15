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
        type: { type: "string", writeable: false },
        name: { type: "string" },
        description: { type: "string" },
        directory: { type: "string", writeable: false },
        owner: {}
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
      let slot = data[slotName];
      if (slot) {
        delete data[slotName];

        const type =
          typeof typeDef.type === "string"
            ? typesByName[typeDef.type]
            : typeDef.type;

        if (typeDef.collection) {
          if (Array.isArray(slot) || typeof slot === "string") {
            slot = asArray(slot);
            if (type) {
              for (const item of slot) {
                new type(this, item);
              }
            } else {
              this[slotName] = slot;
            }
          } else {
            for (const [objectName, objectData] of Object.entries(slot)) {
              objectData.name = objectName;
              new type(this, objectData);
            }
          }
        } else {
          switch (typeDef.type) {
            case "undefined":
              break;
            case "boolean":
            case "string":
            case "number":
              this[slotName] = slot;
              break;

            default:
              this[slotName] = new type(this, slot);
          }
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
    return this.constructor.typeDefinition.name;
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

  toJSON() {
    return extractFrom(this, this.constructor.typeDefinition);
  }
}

export function extractFrom(object, typeDefinition) {
  if (!typeDefinition || object === undefined) {
    return object;
  }

  const json = {};

  do {
    for (const [name, def] of Object.entries(typeDefinition.properties)) {
      let value = object[name];

      switch (typeof value) {
        case "function":
          {
            value = object[name]();

            if (Array.isArray(value)) {
              if (value.length > 0) {
                json[name] = value;
              }
            } else {
              if (typeof value?.next === "function") {
                value = [...value];
                if (value.length > 0) {
                  json[name] = value;
                }
              } else {
                json[name] = value;
              }
            }
          }
          break;
        case "object":
          if (value instanceof Base) {
            json[name] = { type: value.typeName };
            if (value.name) {
              json[name].name = value.name;
            }
          } else {
            if (Array.isArray(value)) {
              json[name] = value;
            } else {
              json[name] = Object.fromEntries(
                Object.entries(value).map(([k, v]) => [
                  k,
                  extractFrom(v, typesByName[def.type])
                ])
              );
            }
          }
          break;
        case "undefined":
          break;

        default:
          json[name] = value;
      }
    }
    typeDefinition = typeDefinition?.extends?.typeDefinition;
  } while (typeDefinition);

  return json;
}
