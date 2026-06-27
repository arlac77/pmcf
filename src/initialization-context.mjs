import { readFile, glob } from "node:fs/promises";
import { join } from "node:path";
import {
  extendingAttributeIterator,
  types,
  resolveTypeLinks,
  create
} from "pacc";
import { Base, root, assign } from "pmcf";

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
    nextOutstanding: for (let { object, attribute, value } of this
      .outstandingResolves) {
      value = object.expand(value);

      for (const type of attribute.type.members || [attribute.type]) {
        for (const node of object.walkDirections(["this", "owner"])) {
          const resolved = this.named(value, node);
          if (resolved) {
            assign(attribute, object, resolved);
            continue nextOutstanding;
          }
        }
      }

      this.error(
        `Unknown ${attribute.name}(${attribute.type.name}): "${value}"`
      );
    }
  }

  resolveLater(object, attribute, value) {
    this.outstandingResolves.push({ object, attribute, value });
  }

  error(...args) {
    console.error(...args);
  }

  instantiateAndAssign(object, attribute, value) {
    if (attribute.type.primitive) {
      return assign(attribute, object, value);
    }

    switch (typeof value) {
      case "undefined":
        return;

      case "function":
        this.error("Invalid value", attribute.name, value);
        break;
      case "object":
        if (attribute.type && value instanceof attribute.type) {
          assign(attribute, object, value);
        } else {
          const newObject = create(attribute.type, object, value);
          this.read(newObject, value);
          assign(attribute, object, newObject);
        }
        break;

      default:
        {
          let o = this.named(value, object);

          /*console.log(
            "NAMED",
            object.fullName,
            value,
            o?.fullName,
            attribute.name
          );*/

          if (
            o &&
            (o.typeName === attribute.type.name ||
              attribute.type.members?.has(o.typeName))
          ) {
            assign(attribute, object, o);
          } else {
            if (attribute.type.constructWithIdentifierOnly) {
              o = create(attribute.type, object, value);
              this.read(o, value);
              assign(attribute, object, o);
            } else {
              this.resolveLater(object, attribute, value);
            }
          }
        }
        break;
    }
  }

  read(object, data, type = object.constructor) {
    if (data?.properties) {
      Object.assign(object.properties, data.properties);
    }

    for (const [path, attribute] of extendingAttributeIterator(
      type,
      attribute => attribute.writable
    )) {
      const name = path.join(".");
      const value = object.expand(data[name]);

      if (attribute.collection) {
        if (typeof value === "object") {
          if (Array.isArray(value)) {
            for (const v of value) {
              this.instantiateAndAssign(object, attribute, v);
            }
          } else {
            if (value instanceof Base) {
              assign(attribute, object, value);
            } else {
              for (const [objectName, objectData] of Object.entries(value)) {
                if (typeof objectData === "object") {
                  objectData[attribute.type.key] = objectName;
                }
                this.instantiateAndAssign(object, attribute, objectData);
              }
            }
          }
          continue;
        }
      }
      this.instantiateAndAssign(object, attribute, value);
    }

    if (data.extends) {
      object.materializeExtends();
    }
  }

  async load(fileName, type) {
    const name = fileName.replace(/\/?([^\/]+\.json)?$/, "");

    let object = this.root.named(name);
    if (object) {
      return object;
    }
    //console.log(`LOAD A "${fileName}" "${name}" "${type?.name}"`);

    if (type === undefined) {
      const tn = fileName.substring(name.length, fileName.length - 5);

      type = types[tn];

      if (!type) {
        for (const type of Object.values(types).filter(type => type.fileName)) {
          try {
            return await this.load(fileName, type);
          } catch {}
        }

        this.error(`No type for "${fileName}"`);
      }
    }

    const data = JSON.parse(
      await readFile(join(this.directory, name, type.fileName), "utf8")
    );

    let owner;
    if (name[0] === "/") {
      const parentName = name.replace(/\/[^\/]+$/, "");

      owner = await this.load(parentName);

      if (!owner) {
        this.error(`No Parent for "${name}" "${parentName}"`);
        return;
      }
      //console.log(`PARENT NAME A "${name}" "${parentName}"`, owner?.fullName);

      data.name = name.substring(owner.fullName.length + 1);

      /*console.log(
          `PARENT NAME B "${name}" "${parentName}" >"${data.name}"<`,
          owner.typeName,
          owner.fullName
        );*/
    } else {
      owner = this.root;
      data.name = name;
    }

    object = create(type, owner, data);

    this.read(object, data);

    //console.log(`LOAD B "${fileName}" "${name}" "${type?.name}" -> ${object.name}`);

    for (const [path, attribute] of extendingAttributeIterator(
      owner.constructor,
      attribute => attribute.type === type && attribute.collection
    )) {
      //console.log("ASSIGN",attribute.name, owner.fullName, object.name);
      return assign(attribute, owner, object);
    }

    this.error(`No attribute to assign ${type.name} to ${owner.fullName}`);
  }

  async loadAll() {
    for (const type of Object.values(types).sort(
      (a, b) => b.priority - a.priority
    )) {
      if (type.fileName) {
        for await (const name of glob("**/" + type.fileName, {
          cwd: this.directory
        })) {
          await this.load("/" + name, type);
        }
      }
    }

    this.resolveOutstanding();
  }

  named(name, base) {
    return name[0] === "/"
      ? this.root.named(name.substring(1))
      : base.named(name);
  }
}
