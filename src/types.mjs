import { baseTypes } from "pacc";
import { asArray } from "./utils.mjs";
import { addServiceTypes } from "./service-types.mjs";

export const types = {};

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
    type.owners = type.owners.map(owner =>
      typeof owner === "string" ? types[owner] : owner
    );

    for (const [name, property] of Object.entries(type.properties)) {
      property.name = name;
      if (property.isKey) {
        type.identifier = property;
      }

      const ts = [];

      for (const type of asArray(property.type)) {
        if (typeof type === "string") {
          if (baseTypes.has(type)) {
            ts.push(type);
          } else {
            const t = types[type];
            if (t) {
              ts.push(t);
            } else {
              console.error(
                "Unknown type",
                property.type,
                type.name,
                name
              );
            }
          }
        } else {
          ts.push(type);
        }
      }
      property.type = ts;

      /*
      if (typeof property.type === "string") {
        if (!baseTypes.has(property.type)) {
          const type = types[property.type];
          if (type) {
            property.type = type;
          } else {
            console.error(
              "Unknown type",
              property.type,
              type.name,
              name
            );
          }
        }
      }

      property.type = asArray(property.type);
      */
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
  return object;
}
