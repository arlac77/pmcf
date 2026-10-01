import {
  addType as addTypeBasic,
  toInternal,
  registerToken,
  DOT,
  asArray,
  primitive_type,
  attributeIterator
} from "pacc";
import { normalizeIP } from "ip-utilties";
import { addServiceType } from "./service-types.mjs";
import { SOURCES_THIS_EXTENDS } from "./common-attributes.mjs";

const SLASH = { ...DOT, str: "/" };

registerToken(SLASH);

addTypeBasic({
  ...primitive_type,
  name: "ip",
  asMapEntry: (attribute, value, object) => [
    normalizeIP(value),
    object.addSubnet(value)
  ]
});

export function addType(type) {
  addTypeBasic(type);

  for (const [path, attribute] of attributeIterator(
    type.attributes,
    attribute => attribute.sources === SOURCES_THIS_EXTENDS
  )) {
    //console.log("SOURCES access", path, type.name);

    const key = "_" + path[0];

    const o = new type();
    Object.defineProperty(Object.getPrototypeOf(o), path[0], {
      get() {
        return this.attribute(key) ?? attribute.default;
      },
      set(newValue) {
        this[key] = newValue;
      },
      enumerable: true,
      configurable: true
    });
  }

  if (type.service) {
    addServiceType(type.service, type.name);
  }
}

function error(message, attribute) {
  throw new Error(message, { cause: attribute.name });
}

export function assign(attribute, object, value) {
  if (value === undefined && object.isTemplate) {
    return;
  }

  value = toInternal(
    value,
    attribute,
    attribute.sources ? undefined : attribute.default
  );

  if (value !== undefined) {
    // set backpointer early so that parent properties can be found during load
    if (attribute.backpointer) {
      assign(attribute.backpointer, value, object);
    }

    if (attribute.deferredExpression) {
      if (object.hasOwnProperty(attribute.name)) {
        error(
          `attribute ${attribute.name} of ${object.fullName} already defined`,
          attribute
        );
      } else {
        Object.defineProperty(object, attribute.name, {
          get: () => object.expression(value)
        });
      }
      return value;
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
            current.set(value[attribute.type.key ?? "name"], value);
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
