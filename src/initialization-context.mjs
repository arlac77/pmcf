import { readFile, glob } from "node:fs/promises";
import { join } from "node:path";
import { toInternal, attributeIterator, types, resolveTypeLinks } from "pacc";
import { asArray } from "./utils.mjs";
import { Base } from "./base.mjs";
import { root } from "./root.mjs";

/**
 * Keeps track of all in flight object creations and loose ends during config initialization.
 */
export class InitializationContext {
  outstandingResolves = [];

  constructor(directory = "/") {
    resolveTypeLinks();
    this.directory = directory;
    this.root = new root(directory);
  }

  resolveOutstanding() {
    nextOutstanding: for (let { object, attribute, name, value } of this
      .outstandingResolves) {
      value = object.expand(value);

      for (const type of attribute.type.members || [attribute.type]) {
        for (const node of object.walkDirections(["this", "owner"])) {
          const resolved = node.typeNamed(type.name, value);
          if (resolved) {
            this.assign(object, name, attribute, resolved);
            continue nextOutstanding;
          }
        }
      }

      this.error(
        `Unable to resolve "${value}" (${attribute.type.name}) for attribute ${name}`,
        object.root.named(value)?.toString()
      );
    }
  }

  resolveLater(object, attribute, name, value) {
    this.outstandingResolves.push({ object, attribute, name, value });
  }

  error(...args) {
    console.error(...args);
  }

  assign(object, name, attribute, value) {
    value = toInternal(value, attribute);
    value ??= attribute.default;

    if (value !== undefined) {
      if (attribute.values) {
        if (attribute.values.indexOf(value) < 0) {
          this.error(name, "unknown value", value, attribute.values);
        }
      }

      if (attribute.collection) {
        const current = object[name];

        switch (typeof current) {
          case "undefined":
            if (attribute.constructor === value.constructor) {
              object[name] = value;
            } else {
              object[name] = asArray(value);
            }
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
                if (value instanceof Set) {
                  object[name] = current.union(value);
                } else {
                  /*if(name === 'extends') {
                    console.log("EXT",object.fullName,value.fullName)
                  }*/
                  object[name].add(value);
                }
              } else if (current instanceof Map) {
                const keyName = attribute.type.key;
                if (keyName) {
                  current.set(value[keyName], value);
                } else {
                  // TODO
                  object[name] = value;
                }
              } else {
                const keyName = attribute.type.key;
                object[name][value[keyName]] = value;
              }
            }
            break;
          case "function":
            if (value instanceof Base) {
              object.addObject(value);
            } else {
              this.error("Unknown collection type", name, current);
            }
            break;
        }
      } else {
        object[name] = value;
      }
    }
  }

  instantiateAndAssign(object, name, attribute, value) {
    if (attribute.type.primitive) {
      this.assign(object, name, attribute, value);
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
          let o;

          for (const type of attribute.type.members || [attribute.type]) {
            o = object.typeNamed(type.name, value);
            if (o) {
              break;
            }
          }

          if (o) {
            this.assign(object, name, attribute, o);
          } else {
            if (attribute.type.constructWithIdentifierOnly) {
              o = new attribute.type(
                object.ownerFor(attribute, value),
                value
              );
              this.read(o, value);
              object.addObject(o);
            } else {
              this.resolveLater(object, attribute, name, value);
            }
          }
        }

        break;

      case "object":
        if (attribute.type && value instanceof attribute.type) {
          this.assign(object, name, attribute, value);
        } else {
          this.assign(
            object,
            name,
            attribute,
            this.typeFactory(
              attribute.type,
              object.ownerFor(attribute, value),
              value
            )
          );
        }
        break;
    }
  }

  typeFactory(type, owner, data) {
    const factory = type.factoryFor?.(owner, data) || type;
    const object = new factory(owner);

    this.read(object, data);
    owner.addObject(object);
    return object;
  }

  read(object, data, type = object.constructor) {
    if (data?.properties) {
      Object.assign(object.properties, data.properties);
    }

    this._read(object, data, type);

    if (data.extends) {
      object.materializeExtends();
    }
  }

  _read(object, data, type) {
    if (type.extends) {
      this._read(object, data, type.extends);
    }

    for (const [path, attribute] of attributeIterator(type.attributes)) {
      if (attribute.writable) {
        const name = path.join(".");
        const value = object.expand(data[name]);

        if (attribute.collection) {
          if (typeof value === "object") {
            if (Array.isArray(value)) {
              for (const v of value) {
                this.instantiateAndAssign(object, name, attribute, v);
              }
            } else {
              if (value instanceof Base) {
                this.assign(object, name, attribute, value);
              } else {
                for (const [objectName, objectData] of Object.entries(value)) {
                  if (typeof objectData === "object") {
                    objectData[attribute.type.key] = objectName;
                  }
                  this.instantiateAndAssign(
                    object,
                    name,
                    attribute,
                    objectData
                  );
                }
              }
            }
            continue;
          }
        }
        this.instantiateAndAssign(object, name, attribute, value);
      }
    }
  }

  async loadType(name, type) {
    const data = JSON.parse(
      await readFile(
        join(this.directory, name, type.fileName),
        "utf8"
      )
    );

    let owner;
    if (name[0] === "/") {
      const parentName = name.replace(/\/[^\/]+$/, "");
      owner = await this.load(parentName);
      data.name = name.substring(owner.fullName.length + 1);
    } else {
      owner = this.root;
      data.name = name;
    }

    const object = this.typeFactory(type, owner, data);

    //console.log("LOAD", [name, type.name, owner.fullName, data.name, object.fullName]);

    this.root.addTypeObject(type.name, name, object);

    return object;
  }

  async load(name, options) {
    name = name.replace(/\/?([^\/]+\.json)?$/, "");

    const object = this.root.named(name);
    if (object) {
      return object;
    }

    if (options?.type) {
      return this.loadType(name, options.type);
    } else {
      for (const type of Object.values(types).filter(
        type => type?.fileName
      )) {
        try {
          return await this.loadType(name, type);
        } catch {}
      }
    }

    const parentName = name.replace(/\/[^\/]$/, "");
    return name === parentName ? this.root : this.load(parentName, options);
  }

  async loadAll() {
    for (const type of Object.values(types).sort(
      (a, b) => b.priority - a.priority
    )) {
      if (type.fileName) {
        for await (const name of glob("**/" + type.fileName, {
          cwd: this.directory
        })) {
          if (type === this.root.constructor) {
            const data = JSON.parse(
              await readFile(join(this.directory, name), "utf8")
            );
            this.root.properties = data.properties;
          } else {
            await this.load("/" + name, { type });
          }
        }
      }
    }

    this.resolveOutstanding();
  }

  named(name) {
    return this.root.named(name);
  }
}
