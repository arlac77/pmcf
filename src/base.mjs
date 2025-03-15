import { join } from "node:path";
import { createReadStream } from "node:fs";
import { allOutputs, extractFunctions } from "npm-pkgbuild";
import { getAttribute } from "pacc";
import { addType, primitives } from "./types.mjs";

const BaseTypeDefinition = {
  name: "base",
  owners: [],
  properties: {
    owner: { type: "base", collection: false, writeable: false },
    type: { type: "string", collection: false, writeable: false },
    name: {
      type: "string",
      collection: false,
      identifier: true,
      writeable: true
    },
   /* fullName: {
      type: "string",
      collection: false,
      identifier: true,
      writeable: false
    },*/
    description: { type: "string", collection: false, writeable: true },
    directory: { type: "string", collection: false, writeable: false },
    packaging: { type: "string", collection: false, writeable: true }
  }
};

export class Base {
  owner;
  description;
  name;

  static {
    addType(this);
  }

  static get typeName() {
    return this.typeDefinition.name;
  }

  static get typeDefinition() {
    return BaseTypeDefinition;
  }

  static get typeFileName() {
    return this.typeName + ".json";
  }

  static get fileNameGlob() {
    return "**/" + this.typeFileName;
  }

  constructor(owner, data) {
    this.owner = owner;

    switch (typeof data) {
      case "string":
        this.name = data;
        break;
      case "object":
        this.read(data, BaseTypeDefinition);
    }

    if (this.name === undefined) {
      this.error("Missing name", this.owner?.toString(), data);
    }
  }

  ownerFor(property, data) {
    for (const type of property.type.owners) {
      if (this.typeName === type?.name) {
        return this;
      }
    }
    for (const type of property.type.owners) {
      const owner = this[type?.name];
      if (owner) {
        return owner;
      }
    }

    return this;
  }

  read(data, type) {
    const assign = (property, value) => {
      if (value !== undefined) {
        if (property.collection) {
          const current = this[property.name];

          switch (typeof current) {
            case "undefined":
              this[property.name] = value;
              break;
            case "object":
              if (Array.isArray(current)) {
                current.push(value);
              } else {
                if (current instanceof Map || current instanceof Set) {
                  // TODO
                  this[property.name] = value;
                } else {
                  this.error("Unknown collection type", property.name, current);
                }
              }
              break;
            case "function":
              if (value instanceof Base) {
                this.addObject(value);
              } else {
                this.error("Unknown collection type", property.name, current);
              }
              break;
          }
        } else {
          this[property.name] = value;
        }
      }
    };

    const instantiateAndAssign = (property, value) => {
      if (primitives.has(property.type)) {
        assign(property, value);
        return;
      }

      switch (typeof value) {
        case "undefined":
          return;
        case "function":
          this.error("Invalid value", property.name, value);
          break;

        case "boolean":
        case "bigint":
        case "number":
        case "string":
          {
            value = this.expand(value);
            let object = this.typeNamed(property.type.name, value);

            if (object) {
              assign(property, object);
            } else {
              if (property.type.constructWithIdentifierOnly) {
                object = new property.type.clazz(
                  this.ownerFor(property, value),
                  value
                );
                this.addObject(object);
              } else {
                this.finalize(() => {
                  value = this.expand(value);
                  const object =
                    this.typeNamed(property.type.name, value) ||
                    this.owner.typeNamed(property.type.name, value) ||
                    this.root.typeNamed(property.type.name, value); // TODO

                  if (object) {
                    assign(property, object);
                  } else {
                    this.error(
                      "Not found",
                      property.name,
                      property.type.name,
                      value
                    );
                  }
                });
              }
            }
          }
          break;
        case "object":
          if (value instanceof property.type.clazz) {
            assign(property, value);
          } else {
            assign(
              property,
              new property.type.clazz(this.ownerFor(property, value), value)
            );
          }
          break;
      }
    };

    for (const property of Object.values(type.properties)) {
      if (property.writeable) {
        const value = data[property.name];
        if (property.collection) {
          if (typeof value === "object") {
            if (Array.isArray(value)) {
              for (const v of value) {
                instantiateAndAssign(property, v);
              }
            } else {
              for (const [objectName, objectData] of Object.entries(value)) {
                objectData[type.identifier.name] = objectName;
                instantiateAndAssign(property, objectData);
              }
            }
            continue;
          }
        }
        instantiateAndAssign(property, value);
      }
    }
  }

  named(name) {}

  typeNamed(typeName, name) {
    if (this.owner) {
      const object = this.owner.typeNamed(typeName, name); // TODO split
      if (object) {
        return object;
      }
    }

    const object = this.named(name);
    if (object?.typeName === typeName) {
      return object;
    }
  }

  addObject(object) {
    return this.owner.addObject(object);
  }

  forOwner(owner) {
    if (this.owner !== owner) {
      // @ts-ignore
      return new this.constructor(owner, this.toJSON());
    }

    return this;
  }

  isNamed(name) {
    return name[0] === "/" ? this.fullName === name : this.name === name;
  }

  relativeName(name) {
    return name?.[0] === "/"
      ? name.substring(this.owner.fullName.length + 1)
      : name;
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

  get domain() {
    return this.owner?.domain;
  }

  get domains() {
    return this.owner?.domains || new Set();
  }

  get localDomains() {
    return this.owner?.localDomains || new Set();
  }

  get administratorEmail() {
    return this.owner?.administratorEmail;
  }

  get locales() {
    return this.owner?.locales;
  }

  get country() {
    return this.owner?.country;
  }

  get timezone() {
    return this.owner?.timezone;
  }

  get smtp() {
    return this.findService({ type: "smtp" });
  }

  findService(filter) {
    let best;
    for (const service of this.findServices(filter)) {
      if (!best || service.priority < best.priority) {
        best = service;
      }
    }

    return best;
  }

  *findServices(filter) {
    if (this.owner) {
      yield* this.owner.findServices(filter);
    }
  }

  #directory;
  set directory(directory) {
    this.#directory = directory;
  }

  get directory() {
    return this.#directory || join(this.owner.directory, this.name);
  }

  get fullName() {
    return this.name
      ? join(this.owner.fullName, "/", this.name)
      : this.owner.fullName;
  }

  #packaging = new Set();

  set packaging(value) {
    this.#packaging.add(value);
  }

  get derivedPackaging() {
    return this.owner?.packaging;
  }

  get packaging() {
    const dp = this.derivedPackaging;

    if (dp) {
      return this.#packaging.union(dp);
    }

    return this.#packaging;
  }

  #packageHooks = {};

  get packageHooks() {
    return this.#packageHooks;
  }

  async loadPackageHooks(file) {
    for await (const f of extractFunctions(createReadStream(file, "utf8"))) {
      this.addPackageHook(f.name, f.body);
    }
  }

  addPackageHook(name, content) {
    const hook = this.#packageHooks[name];
    if (hook) {
      content = hook + "\n" + content;
    }

    this.#packageHooks[name] = content;
  }

  get outputs() {
    return new Set(allOutputs.filter(o => this.packaging.has(o.name)));
  }

  async *preparePackages(stagingDir) {
    yield {
      sources: [],
      outputs: this.outputs,
      properties: {
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private"
      }
    };
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

export function extractFrom(
  object,
  typeDefinition = object?.constructor?.typeDefinition
) {
  if (Array.isArray(object)) {
    if (object.length === 0) {
      return undefined;
    }

    if (typeDefinition?.identifier) {
      return Object.fromEntries(
        object.map(o => {
          o = extractFrom(o);
          const name = o[typeDefinition.identifier.name];
          delete o[typeDefinition.identifier.name];
          return [name, o];
        })
      );
    }

    return object.map(o => extractFrom(o));
  }

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

            if (typeof value?.next === "function") {
              value = [...value];
            }

            value = extractFrom(value, def.type);
            if (value !== undefined) {
              json[name] = value;
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
              json[name] = extractFrom(value);
            } else {
              const resultObject = Object.fromEntries(
                Object.entries(value).map(([k, v]) => [
                  k,
                  v // extractFrom(v, def.type)
                ])
              );
              if (Object.keys(resultObject).length > 0) {
                json[name] = resultObject;
              }
            }
          }
          break;
        case "undefined":
          break;

        default:
          json[name] = value;
      }
    }
    typeDefinition = typeDefinition?.extends;
  } while (typeDefinition);

  return json;
}
