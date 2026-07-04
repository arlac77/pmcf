import { addType as addTypeBasic, toInternal } from "pacc";
import { normalizeIP } from "ip-utilties";
import { addServiceType } from "pmcf";
import { asArray } from "./utils.mjs";

addTypeBasic({
  name: "ip",
  primitive: true,
  asMapEntry: (attribute, value, object) => [
    normalizeIP(value),
    object.addSubnet(value)
  ]
});

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
      assign(attribute.backpointer, value, object);
    }

    if (attribute.collection) {
      const current = object[attribute.name];

      if (current) {
        if (typeof current.set === "function") {
          if (attribute.type.primitive) {
            if (attribute.type.asMapEntry) {
              for (const v of asArray(value)) {
                const [key, value] = attribute.type.asMapEntry(
                  attribute,
                  v,
                  object
                );
                current.set(key, value);
              }
            } else {
              for (const v of asArray(value)) {
                current.set(v, v);
              }
            }
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
