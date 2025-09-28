import {
  attributeIterator,
  types,
  oneOfType,
  addType as paccAddType
} from "pacc";
import { addServiceType } from "./service-types.mjs";
export { types };

export function addType(clazz) {
  const type = clazz.typeDefinition;
  type.clazz = clazz;

  if (type.specializationOf) {
    type.specializationOf.specializations[type.name] = type;
  }

  addServiceType(type.service, type.name);
  paccAddType(type);
}

export function resolveTypeLinks() {
  for (const type of Object.values(types)) {
    if (typeof type.extends === "string") {
      type.extends = types[type.extends];
    }

    if (type.owners) {
      type.owners = type.owners.map(owner =>
        typeof owner === "string" ? types[owner] : owner
      );
    }

    for (const [path, attribute] of attributeIterator(type.attributes)) {
      if (typeof attribute.type === "string") {
        attribute.type = oneOfType(attribute.type);
      }
    }
  }
}

export function typeFactory(type, owner, data) {
  const factory = type.factoryFor?.(owner, data) || type.clazz;
  //console.log(factory, type, owner, data);
  const object = new factory(owner);
  object.read(data);
  owner.addObject(object);
  return object;
}
