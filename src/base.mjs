import { join } from "node:path";
import { allOutputs } from "npm-pkgbuild";
import {
  createExpressionTransformer,
  transform
} from "content-entry-transform";
import { FileContentProvider } from "npm-pkgbuild";
import {
  getAttribute,
  toInternal,
  typeFactory,
  addType,
  parse,
  globals,
  expand,
  toExternal,
  filterPublic,
  attributeIterator,
  default_attribute,
  name_attribute_writable,
  string_attribute,
  string_attribute_writable,
  string_set_attribute_writable,
  number_attribute_writable,
  description_attribute_writable,
  boolean_attribute_writable
} from "pacc";
import { asArray } from "./utils.mjs";

/**
 *
 * attributes: essential values
 * properties: use defined values to support attribute value definitions
 */
export class Base {
  static name = "base";
  static key = "name";
  static attributes = {
    owner: { ...default_attribute, type: "base" },
    type: string_attribute,
    name: name_attribute_writable,
    description: description_attribute_writable,
    priority: number_attribute_writable,
    directory: string_attribute_writable,
    packaging: string_attribute_writable,
    disabled: boolean_attribute_writable,
    tags: string_set_attribute_writable
  };

  owner;
  description;
  name;
  extends = [];
  _tags = new Set();
  _packaging = new Set();
  _directory;
  _finalize;
  _properties;

  static {
    addType(this);
  }

  static get typeName() {
    return this.typeDefinition.name;
  }

  static get typeDefinition() {
    return this;
  }

  static get typeFileName() {
    return this.typeName + ".json";
  }

  /**
   *
   * @param {Base} owner
   * @param {object} [data]
   */
  constructor(owner, data) {
    this.owner = owner;

    switch (typeof data) {
      case "string":
        this.name = data;
        break;
      case "object":
        this.read(data, this.constructor);
    }
  }

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

  read(data, type = this.constructor.typeDefinition) {
    if (type.extends) {
      this.read(data, type.extends);
    }

    const assign = (name, attribute, value) => {
      value = toInternal(value, attribute);
      value ??= attribute.default;

      if (value !== undefined) {
        if (attribute.values) {
          if (attribute.values.indexOf(value) < 0) {
            this.error(name, "unknown value", value, attribute.values);
          }
        }

        if (attribute.collection) {
          const current = this[name];

          switch (typeof current) {
            case "undefined":
              this[name] = asArray(value);
              break;
            case "object":
              if (Array.isArray(current)) {
                if (Array.isArray(value)) {
                  current.push(...value);
                } else {
                  current.push(value);
                }
              } else {
                if (current instanceof Set) {
                  // TODO
                  this[name] = value;
                } else if (current instanceof Map) {
                  // TODO
                  this[name] = value;
                } else {
                  this.error("Unknown collection type", name, current);
                }
              }
              break;
            case "function":
              if (value instanceof Base) {
                this.addObject(value);
              } else {
                this.error("Unknown collection type", name, current);
              }
              break;
          }
        } else {
          this[name] = value;
        }
      }
    };

    const instantiateAndAssign = (name, attribute, value) => {
      if (attribute.type.primitive) {
        assign(name, attribute, value);
        return;
      }

      switch (typeof value) {
        case "undefined":
          return;
        case "function":
          this.error("Invalid value", name, value);
          break;

        case "boolean":
        case "bigint":
        case "number":
        case "string":
          {
            let object;

            for (const type of attribute.type.members || [attribute.type]) {
              object = this.typeNamed(type.name, value);
              if (object) {
                break;
              }
            }

            if (object) {
              assign(name, attribute, object);
            } else {
              if (attribute.type.constructWithIdentifierOnly) {
                object = new attribute.type.clazz(
                  this.ownerFor(attribute, value),
                  value
                );
                object.read(value);
                this.addObject(object);
              } else {
                this.finalize(() => {
                  value = this.expand(value);

                  for (const type of attribute.type.members || [
                    attribute.type
                  ]) {
                    const object =
                      this.typeNamed(type.name, value) ||
                      this.owner.typeNamed(type.name, value) ||
                      this.root.typeNamed(type.name, value); // TODO

                    if (object) {
                      assign(name, attribute, object);
                      return;
                    }
                  }

                  this.error(
                    `No such object "${value}" (${attribute.type.name}) for attribute ${name}`,
                    this.root.named(value)?.toString()
                  );
                });
              }
            }
          }
          break;
        case "object":
          if (attribute.type.clazz && value instanceof attribute.type.clazz) {
            assign(name, attribute, value);
          } else {
            assign(
              name,
              attribute,
              typeFactory(
                attribute.type,
                this.ownerFor(attribute, value),
                value
              )
            );
          }
          break;
      }
    };

    if (data?.properties) {
      this._properties = data.properties;
    }

    for (const [path, attribute] of attributeIterator(type.attributes)) {
      if (attribute.writable) {
        const name = path.join(".");
        const value = this.expand(data[name]);

        if (attribute.collection) {
          if (typeof value === "object") {
            if (Array.isArray(value)) {
              for (const v of value) {
                instantiateAndAssign(name, attribute, v);
              }
            } else {
              if (value instanceof Base) {
                assign(name, attribute, value);
              } else {
                for (const [objectName, objectData] of Object.entries(value)) {
                  if (typeof objectData === "object") {
                    //console.log("KEY", objectName, type.name, type.key);
                    objectData[attribute.type.key] = objectName;
                  }
                  instantiateAndAssign(name, attribute, objectData);
                }
              }
            }
            continue;
          }
        }
        instantiateAndAssign(name, attribute, value);
      }
    }

    if (data?.extends) {
      this.finalize(() => {
        for (const object of this.extends) {
          object.execFinalize();
          this._applyExtends(object);
        }
      });
    }

    /*if(this.type) {
      console.log(this.toString(),this.name,this.fullName);
    }*/
  }

  _applyExtends() {}

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

  *walkDirections(directions = ["this", "extends", "owner"]) {
    yield* this._walkDirections(
      directions,
      directions.indexOf("this") >= 0,
      new Set()
    );
  }

  *_walkDirections(directions, withThis, seen) {
    if (!seen.has(this)) {
      seen.add(this);

      if (withThis) {
        yield this;
      }
      for (const direction of directions) {
        const value = this[direction];

        if (value) {
          if (value[Symbol.iterator]) {
            for (const node of value) {
              yield* node._walkDirections(directions, true, seen);
            }
          } else {
            yield* value._walkDirections(directions, true, seen);
          }
        }
      }
    }
  }

  forOwner(owner) {
    if (this.owner !== owner) {
      const newObject = Object.create(this);
      newObject.extends = [...this.extends];
      newObject.owner = owner;
      return newObject;
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

  /**
   *
   * @param {string} name
   * @returns {any}
   */
  extendedAttribute(name) {
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
  *propertyIterator(filter) {
    for (
      let typeDefinition = this.constructor.typeDefinition;
      typeDefinition;
      typeDefinition = typeDefinition.extends
    ) {
      for (const [path, def] of attributeIterator(
        typeDefinition.attributes,
        filter
      )) {
        const name = path.join(".");
        const value = this.extendedAttribute(name);

        if (value !== undefined) {
          yield [def.externalName ?? name, toExternal(value, def), path, def];
        }
      }
    }
  }

  /**
   * Retrive attribute values from an object.
   * @param {Function} [filter]
   * @return {Object} values
   */
  getProperties(filter = filterPublic) {
    return Object.fromEntries(this.propertyIterator(filter));
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
    return this.findService('type="smtp"');
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
      getGlobal: x => this.getGlobal(x),
      ...options
    });
  }

  /**
   *
   * @param {any} filter
   * @returns service with the highest priority
   */
  findService(filter) {
    let best;
    for (const service of this.findServices(filter)) {
      if (!best || service.priority > best.priority) {
        best = service;
      }
    }

    return best;
  }

  *findServices(filter) {
    yield* this.owner?.findServices(filter);
  }

  set directory(directory) {
    this._directory = directory;
  }

  get directory() {
    return this._directory ?? join(this.owner.directory, this.name);
  }

  get fullName() {
    return this.name
      ? join(this.owner.fullName, "/", this.name)
      : this.owner.fullName;
  }

  set packaging(value) {
    this._packaging.add(value);
  }

  get derivedPackaging() {
    return this.owner?.packaging;
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

  async *preparePackages(stagingDir) {}

  get templateTransformers() {
    return [
      createExpressionTransformer(
        e => e.isBlob,
        expression =>
          parse(expression, {
            root: this,
            getGlobal: id => this.getGlobal(id)
          })
      )
    ];
  }

  templateContent(entryProperties, directoryProperties) {
    return [...this.walkDirections(["this", "extends"])].map(e =>
      transform(
        new FileContentProvider(
          { dir: join(e.directory, "content"), pattern: "**/*" },
          entryProperties,
          directoryProperties
        ),
        this.templateTransformers
      )
    );
  }

  get tags() {
    return this._tags;
  }

  set tags(value) {
    if (value instanceof Set) {
      this._tags = this._tags.union(value);
    } else {
      this._tags.add(value);
    }
  }

  get isTemplate() {
    return this.name?.indexOf("*") >= 0 || this.owner?.isTemplate || false;
  }

  getGlobal(a) {
    return globals[a] ?? this.extendedAttribute(a) ?? this.property(a);
  }

  get properties() {
    return this._properties;
  }

  /**
   *
   * @param {string} name
   * @returns {any}
   */
  property(name) {
    for (const node of this.walkDirections(["this", "extends", "owner"])) {
      const value = node._properties?.[name];
      if (value !== undefined) {
        return this.expand(value);
      }
    }
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
      getGlobal: name => this.getGlobal(name)
    });
  }

  finalize(action) {
    if (!this._finalize) {
      this._finalize = [];
    }
    this._finalize.push(action);
  }

  execFinalize() {
    this.traverse(object => object._execFinalize());
  }

  _execFinalize() {
    if (this._finalize) {
      let i = 0;
      for (const action of this._finalize) {
        if (action) {
          this._finalize[i] = undefined;
          action();
        }
        i++;
      }
    }
  }

  traverse(visitor, ...args) {
    const visited = new Set();
    this._traverse(visited, visitor, ...args);
    return visited;
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
  switch (typeof object) {
    case "undefined":
    case "string":
    case "number":
    case "boolean":
      return object;
  }

  if (typeof object[Symbol.iterator] === "function") {
    object = [...object];

    if (object.length === 0) {
      return undefined;
    }

    if (typeDefinition?.key) {
      return Object.fromEntries(
        object.map(o => {
          o = extractFrom(o);
          const name = o[typeDefinition.key];
          delete o[typeDefinition.key];
          return [name, o];
        })
      );
    }

    return object.length ? object : undefined;
  }

  const json = {};

  for (; typeDefinition; typeDefinition = typeDefinition.extends) {
    for (const [path, def] of attributeIterator(
      typeDefinition.attributes,
      filterPublic
    )) {
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
  }

  return json;
}
