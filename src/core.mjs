import { AggregatedMap } from "aggregated-map";

import {
  toExternal,
  filterPublic,
  parse,
  extendingAttributeIterator,
  getAttribute,
  expand,
  globals
} from "pacc";
import { addType } from "pmcf";

export class core {
  static priority = 1;

  static {
    addType(this);
  }

  extends = new Set();

  constructor(owner, data) {
    if (owner) {
      this.owner = owner;
    }
  }

  set owner(value) {
    if (this === value || this === value?.owner) {
      this.error("Unable to own myself", value.fullName);
    } else {
      this._owner = value;
    }
  }

  get owner() {
    return this._owner;
  }

  forOwner(owner) {
    if (this.owner !== owner) {
      const newObject = Object.create(this);
      newObject.owner = owner;
      return newObject;
    }

    return this;
  }

  materializeExtends() {
    for (const [path, attribute] of extendingAttributeIterator(
      this.constructor,
      attribute => attribute.collection && !attribute.type.primitive
    )) {
      if (attribute.deferredExpression) {
        const name = attribute.name;
        if (!this.hasOwnProperty(name)) {
          for (const e of this.walkDirections(["extends"])) {
            if (e.hasOwnProperty(name)) {
              Object.defineProperty(this, name, {
                get: () => e[name]
              });
              break;
            }
          }
        }

        continue;
      }

      const collection = this[attribute.name];

      if (typeof collection?.get === "function") {
        for (const [name, extending] of this.mapFromDirections(
          ["extends"],
          attribute.name
        )) {
          const present = collection.get(extending.name);

          if (present) {
            present.extends.add(extending);
            present.materializeExtends();
          } else {
            collection.set(extending.name, extending.forOwner(this));
          }
        }
      } /*else {
        if (Array.isArray(collection)) {
          // TODO
        } else {
          //console.log("EXTENDS", this.fullName, attribute.name);

          for (const extending of this.unionFromDirections(
            ["extends"],
            attribute.name
          )) {
            if (!collection.has(extending)) {
              //console.log("ADD", this.fullName, extending.fullName);
              collection.add(extending);
            }
          }
        }
      }*/
    }
  }

  get typeName() {
    return this.constructor.name;
  }

  /**
   * Retrive attribute values from an object.
   * @param {Function} [filter]
   * @return {Iterable<[string,any]>} values
   */
  *attributeIterator(filter) {
    for (const [path, attribute] of extendingAttributeIterator(
      this.constructor,
      filter
    )) {
      const name = path.join(".");
      const value = this.attribute(name);

      if (value !== undefined) {
        yield [
          attribute.externalName ?? name,
          toExternal(value, attribute),
          path,
          attribute
        ];
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

  value(name) {
    return this.attribute(name);
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
   * Walk the object graph in some directions and deliver seen nodes.
   * @param {string[]} directions
   * @return {Iterable<core>}
   */
  *walkDirections(directions = ["this", "extends", "owner"]) {
    if (directions.indexOf("this") >= 0) {
      yield this;
      directions = directions.filter(d => d !== "this");
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

  /**
   * Deliver AggregatedMap of all property Maps.
   * @param {string[]} directions
   * @param {string} property
   * @returns {Map<any,any>}
   */
  mapFromDirections(directions, property) {
    return new AggregatedMap(
      [...this.walkDirections(directions)]
        .map(node => node[property])
        .filter(node => node !== undefined)
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
      const value = node[property];
      if (value !== undefined) {
        if (!(value instanceof Set)) {
          console.log("NO SET", value, node.fullName, property);
        }
        collected = collected.union(value);
      }
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
              if (value instanceof core) {
                this.error(
                  `Unexpected scalar value for "${attribute.name}"`,
                  value.fullName
                );
                all.push(value); // TODO should not happen
              } else if (typeof value === "object") {
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
   *
   * @param {any} object
   * @returns {any}
   */
  expand(object) {
    if (this.isTemplate || object instanceof core) {
      return object;
    }

    return expand(object, {
      stopClass: core,
      root: this.root,
      current: this,
      valueFor: (name, at) =>
        typeof at?.value === "function" ? at.value(name) : globals[name]
    });
  }

  /**
   *
   * @param {string} expression
   * @param {object} options
   * @returns {any}
   */
  expression(expression, options) {
    return parse(expression, {
      root: this.root,
      current: this,
      valueFor: (name, at) =>
        typeof at?.value === "function" ? at.value(name) : globals[name],
      ...options
    });
  }

  get isTemplate() {
    return false;
  }

  get root() {
    return this.owner?.root;
  }
}
