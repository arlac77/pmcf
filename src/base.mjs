import { join } from "node:path";
import { stat } from "node:fs/promises";
import { AggregatedMap } from "aggregated-map";
import { allOutputs } from "npm-pkgbuild";
import {
  createExpressionTransformer,
  transform
} from "content-entry-transform";
import { FileContentProvider } from "npm-pkgbuild";
import {
  getAttribute,
  parse,
  globals,
  expand,
  toExternal,
  filterPublic,
  extendingAttributeIterator,
  name_attribute_writable,
  type_attribute,
  string_attribute_writable,
  string_set_attribute_writable,
  description_attribute_writable,
  boolean_attribute_writable
} from "pacc";
import { union } from "./utils.mjs";
import { addType } from "pmcf";
import { owner_attribute } from "./common-attributes.mjs";

/**
 *
 * attributes: as declared in the types
 * properties: use defined values to support attribute value definitions
 */
export class Base {
  static name = "base";
  static key = "name";
  static priority = 0;
  static attributes = {
    name: name_attribute_writable,
    description: description_attribute_writable,
    owner: owner_attribute,
    type: type_attribute,
    directory: { ...string_attribute_writable, name: "directory" },
    packaging: { ...string_attribute_writable, name: "packaging" },
    disabled: { ...boolean_attribute_writable, name: "disabled" },
    tags: { ...string_set_attribute_writable, name: "tags" }
  };

  static {
    addType(this);
  }

  static get fileName() {
    return this.name + ".json";
  }

  owner;
  description;
  name;
  properties = {};
  extends = new Set();
  _tags = new Set();
  _packaging = new Set();
  _directory;

  ownerFor(attribute, data) {
    const owners = attribute.type.owners;

    if (owners) {
      for (const type of owners) {
        if (this.typeName === type?.name) {
          return this;
        }
      }
      for (const type of owners) {
        const owner = this[type?.name];
        if (owner) {
          return owner;
        }
      }
    }
    return this;
  }

  materializeExtends() {}

  named(name) {
    if (name[0] === "/") {
      return this.root.named(name.substring(1));
    }

    const parts = name.split("/");
    const first = parts.shift();

    //  console.log("NAMED",this.fullName,name,parts,first);

    for (const [path, attribute] of extendingAttributeIterator(
      this.constructor,
      attribute => !attribute.type.primitive
    )) {
      const value = this[path];
      if (typeof value?.get === "function") {
        const object = value.get(first);
        if (object) {
          return parts.length >= 1 ? object.named(parts.join("/")) : object;
        }
      }
    }
  }

  /**
   * Deliver AggregatedMap of all property Maps.
   * @param {string[]} directions
   * @param {string} property
   * @returns {Map<any,any>}
   */
  mapFromDirections(directions, property) {
    return new AggregatedMap(
      [...this.walkDirections(directions)].map(node => node[property])
    );
  }

  /**
   * Deliver union set of all property values.
   * @param {string[]} directions
   * @param {string} property
   * @returns {Set<any>}
   */
  unionFromDirections(directions, property) {
    let collected = new Set();
    for (const node of this.walkDirections(directions)) {
      collected = collected.union(node[property]);
    }

    return collected;
  }

  get children() {
    const all = [];

    for (const [path, attribute] of extendingAttributeIterator(
      this.constructor,
      attribute => attribute.backpointer?.name === "owner"
    )) {
      const value = this[path];

      if (value !== undefined) {
        if (attribute.collection) {
          if (typeof value.values === "function") {
            all.push(...value.values());
          } else {
            if (value instanceof Iterator) {
              all.push(...value);
            } else {
              if (value instanceof Base) {
                this.error(
                  `Unexpected scalar value for "${attribute.name}"`,
                  value.fullName
                );
                all.push(value); // TODO should not happen
              } else if (typeof value === "object") {
                //console.log("NO F", this.fullName, path, value);
                all.push(...Object.values(value));
              }
            }
          }
        } else {
          all.push(value);
        }
      }
    }

    return all;
  }

  /**
   * Walk the object graph in some directions and deliver seen nodes.
   * @param {string[]} directions
   * @return {Iterable<Base>}
   */
  *walkDirections(directions = ["this", "extends", "owner"]) {
    if (directions.indexOf("this") >= 0) {
      yield this;
      directions = directions.filter(d => d != "this");
    }

    yield* this._walkDirections(directions, new Set());
  }

  *_walkDirections(directions, seen) {
    if (!seen.has(this)) {
      seen.add(this);

      for (const direction of directions) {
        const value = this[direction];

        if (value) {
          if (value[Symbol.iterator]) {
            for (const node of value) {
              yield node;
              yield* node._walkDirections(directions, seen);
            }
          } else {
            yield value;
            yield* value._walkDirections(directions, seen);
          }
        }
      }
    }
  }

  forOwner(owner) {
    if (this.owner !== owner) {
      const newObject = Object.create(this);
      newObject.owner = owner;
      return newObject;
    }

    return this;
  }

  isNamed(name) {
    return name[0] === "/" ? this.fullName === name : this.name === name;
  }

  *find(pattern) {
    for (const node of this.walkDirections(["children"])) {
      for (const p of pattern) {
        if (node.fullName.match(p)) {
          yield node;
          break;
        }
      }
    }
  }

  get typeName() {
    return this.constructor.name;
  }

  /**
   *
   * @param {string} name
   * @returns {any}
   */
  attribute(name) {
    for (const node of this.walkDirections(["this", "extends"])) {
      const value = getAttribute(node, name);
      if (value !== undefined) {
        return this.expand(value);
      }
    }
  }

  /**
   * Retrive attribute values from an object.
   * @param {Function} [filter]
   * @return {Iterable<[string,any]>} values
   */
  *attributeIterator(filter) {
    for (const [path, def] of extendingAttributeIterator(
      this.constructor,
      filter
    )) {
      const name = path.join(".");
      const value = this.attribute(name);

      if (value !== undefined) {
        yield [def.externalName ?? name, toExternal(value, def), path, def];
      }
    }
  }

  /**
   * Retrive attribute values from an object.
   * @param {Function} [filter]
   * @return {Object} values
   */
  getAttributes(filter = filterPublic) {
    return Object.fromEntries(this.attributeIterator(filter));
  }

  valueFor(name, at) {
    if (at !== undefined) {
      return this.attribute(name) ?? this.property(name);
    }

    return globals[name];
  }

  /**
   *
   * @param {string} name
   * @returns {any}
   */
  property(name) {
    for (const node of this.walkDirections()) {
      const value = node.properties[name];

      if (value !== undefined) {
        return this.expand(value);
      }
    }
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
    return this.owner?.domains ?? new Set();
  }

  get localDomains() {
    return this.owner?.localDomains ?? new Set();
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

  set priority(value) {
    this._priority = value;
  }

  /**
   * @return {number}
   */
  get priority() {
    return this._priority ?? this.owner?.priority;
  }

  get smtp() {
    return this.expression("services[types[smtp]][0]");
  }

  /**
   *
   * @param {string} expression
   * @param {object} options
   * @returns {any}
   */
  expression(expression, options) {
    return parse(expression, {
      root: this,
      valueFor: (name, at) => this.valueFor(name, at),
      ...options
    });
  }

  get services() {
    return this.owner?.services || new Map();
  }

  set directory(directory) {
    this._directory = directory;
  }

  get directory() {
    return this._directory ?? join(this.owner.directory, this.name);
  }

  get fullName() {
    return this.owner ? join(this.owner.fullName, "/", this.name) : this.name;
  }

  get derivedPackaging() {
    return this.owner?.packaging;
  }

  set packaging(value) {
    this._packaging = union(value, this._packaging);
  }

  get packaging() {
    const dp = this.derivedPackaging;

    if (dp) {
      return this._packaging.union(dp);
    }

    return this._packaging;
  }

  get outputs() {
    return new Set(allOutputs.filter(o => this.packaging.has(o.name)));
  }

  get packageData() {
    const nameParts = [this.typeName, this.owner?.name, this.name];
    return {
      sources: [],
      outputs: this.outputs,
      properties: {
        name: nameParts.filter(n => n !== undefined && n.length > 0).join("-"),
        access: "private",
        dependencies: this.depends,
        groups: [this.typeName]
      }
    };
  }

  async *preparePackages(stagingDir) {}

  get templateTransformers() {
    return [
      createExpressionTransformer(
        e => e.isBlob,
        expression =>
          parse(expression, {
            root: this,
            valueFor: (name, at) => this.valueFor(name, at)
          })
      )
    ];
  }

  /**
   *
   * @param {*} entryProperties
   * @param {*} directoryProperties
   * @returns {AsyncIterable<ContentProvider>}
   */
  async *templateContent(entryProperties, directoryProperties) {
    for (const node of this.walkDirections(["this", "extends"])) {
      const dir = join(node.directory, "content");

      try {
        if ((await stat(dir)).isDirectory) {
          yield transform(
            new FileContentProvider(
              { dir, pattern: "**/*" },
              entryProperties,
              directoryProperties
            ),
            this.templateTransformers
          );
        }
      } catch (e) {
        if (e.code !== "ENOENT") {
          throw e;
        }
      }
    }
  }

  get tags() {
    return this.unionFromDirections(["this", "extends"], "_tags");
  }

  set tags(value) {
    this._tags = union(value, this._tags);
  }

  /**
   * @return {boolean}
   */
  get isTemplate() {
    return this.name?.indexOf("*") >= 0 || this.owner?.isTemplate || false;
  }

  /**
   *
   * @param {any} object
   * @returns {any}
   */
  expand(object) {
    if (this.isTemplate || object instanceof Base) {
      return object;
    }

    return expand(object, {
      stopClass: Base,
      root: this,
      valueFor: (name, at) => this.valueFor(name, at)
    });
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
    return extractFrom(this, this.constructor);
  }
}

export function extractFrom(object, type = object?.constructor) {
  switch (typeof object) {
    case "undefined":
    case "string":
    case "number":
    case "boolean":
      return object;
  }

  if (object instanceof Set) {
    object = [...object];
  }

  if (typeof object[Symbol.iterator] === "function") {
    object = [...object].map(o => (o instanceof Base ? extractFrom(o) : o));

    if (object.length === 0) {
      return undefined;
    }

    if (type?.key) {
      return Object.fromEntries(
        object.map(o => {
          o = extractFrom(o);
          const name = o[type.key];
          delete o[type.key];
          return [name, o];
        })
      );
    }

    return object.length ? object : undefined;
  }

  const json = {};

  for (const [path, def] of extendingAttributeIterator(type, filterPublic)) {
    const name = path.join(".");
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
          if (typeof value[Symbol.iterator] === "function") {
            value = extractFrom(value);

            if (value !== undefined) {
              json[name] = value;
            }
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

  return json;
}
