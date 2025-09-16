import { baseTypes, attributeIterator, types } from "pacc";
import { asArray } from "./utils.mjs";
import { addServiceTypes } from "./service-types.mjs";
export { types };

export function addType(clazz) {
  const type = clazz.typeDefinition;

  if (type.specializationOf) {
    type.specializationOf.specializations[type.name] = type;
  }

  if (type.service) {
    addServiceTypes({ [type.name]: type.service });
  }

  types[type.name] = type;

  type.clazz = clazz;
}

export function resolveTypeLinks() {
  for (const type of Object.values(types)) {
    if (type.owners) {
      type.owners = type.owners.map(owner =>
        typeof owner === "string" ? types[owner] : owner
      );
    } else {
      type.owners = [];
    }
    for (const [path, attribute] of attributeIterator(type.attributes)) {
      const name = path.join(".");
      attribute.name = name;
      const ts = [];

      for (const type of asArray(attribute.type)) {
        if (typeof type === "string") {
          if (baseTypes.has(type)) {
            ts.push(type);
          } else {
            const t = types[type];
            if (t) {
              ts.push(t);
            } else {
              console.error("Unknown type", attribute.type, type.name, name);
            }
          }
        } else {
          ts.push(type);
        }
      }
      attribute.type = ts;

      if (attribute.isKey) {
        type.identifier = { name, ...attribute };
      }
    }
  }

  for (const type of Object.values(types)) {
    if (!type.identifier) {
      if (type.extends?.identifier) {
        type.identifier = type.extends.identifier;
      }
    }
  }
}

export function typeFactory(type, owner, data) {
  const factory = type.factoryFor?.(owner, data) || type.clazz;
  const object = new factory(owner);
  object.read(data);
  owner.addObject(object);
  return object;
}
