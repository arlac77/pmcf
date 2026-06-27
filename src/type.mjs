import { addType as addTypeBasic, toInternal } from "pacc";
import { addServiceType } from "pmcf";
import { asArray } from "./utils.mjs";

export function addType(type) {
  addTypeBasic(type);

  if (type.service) {
    addServiceType(type.service, type.name);
  }
}

function error(message, attribute) {
  throw new Error(message, { cause: attribute.name });
}

export function assign(attribute, object, value) {
  value = toInternal(value, attribute);
  value ??= attribute.default;

  if (value !== undefined) {
    if (attribute.values) {
      if (!attribute.values.has(value)) {
        error("unkown value", attribute);
      }
    }

    if (attribute.backpointer) {
      /*console.log(
            "BACKPOINTER",
            attribute.backpointer.name,
            value.fullName,
            object.fullName
          );*/
      assign(attribute.backpointer, value, object);
    }

    /*if (!attribute.type.primitive) {
      if (typeof attribute.type !== "function") {
        //   error(`XX Invalide type ${attribute.name} ${attribute.type}`,attribute);
      } else {
        if (value.constructor instanceof attribute.type) {
          error(`Invalide type ${value.constructor.name}`, attribute);
        }
      }
    }*/

    if (attribute.collection) {
      const current = object[attribute.name];

      //console.log("ASSIGN", object.fullName, attribute.name, value.name);
      if (current) {
        if (typeof current.set === "function") {
          if (attribute.type.primitive) {
            for (const v of asArray(value)) {
              current.set(v, v);
            }
            //   console.log("SET", attribute.name, current);
          } else {
            current.set(value[attribute.type.key || "name"], value);
          }
        } else {
          if (typeof current.add === "function") {
            if (value instanceof Set) {
              object[attribute.name] = current.union(value);
            } else {
              current.add(value);
            }
          } else {
            if (Array.isArray(current)) {
              if (Array.isArray(value)) {
                current.push(...value);
              } else {
                current.push(value);
              }
            } else {
              object[attribute.name][value[attribute.type.key]] = value;
            }
          }
        }
      } else {
        object[attribute.name] =
          attribute.constructor === value.constructor ? value : asArray(value);
      }
    } else {
      object[attribute.name] = value;
    }
  }

  return value;
}
