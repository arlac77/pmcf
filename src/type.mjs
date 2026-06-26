import { addType as addTypeBasic, toInternal } from "pacc";
import { addServiceType } from "pmcf";
import { asArray } from "./utils.mjs";

export function addType(type) {
  addTypeBasic(type);

  if (type.service) {
    addServiceType(type.service, type.name);
  }
}

export function create(type, owner, data) {
  const factory = type.factoryFor?.(owner, data) || type;
  return new factory(data);
}

function error(message, attribute) {
  throw new Error(message, { cause: attribute.name });
}

export function assign(attribute, object, value) {
  value = toInternal(value, attribute);
  value ??= attribute.default;

  if (value !== undefined) {
    if (attribute.values) {
      if (attribute.values.indexOf(value) < 0) {
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

    if (attribute.collection) {
      const current = object[attribute.name];

      //console.log("ASSIGN", object.fullName, attribute.name, value.name);
      if (current) {
        if (typeof current.set === "function") {
          const keyName = attribute.type.key;
          if (keyName) {
            current.set(value[keyName], value);
          } else {
            current.set(value.name, value);
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
