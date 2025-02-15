export function addType(clazz) {
  types.push(clazz);

  const typeDefinition = clazz.typeDefinition;
  typeDefinition.clazz = clazz;

  typesByName[typeDefinition.name] = clazz;

  for (const type of types) {
    for (const [name, property] of Object.entries(
      type.typeDefinition.properties
    )) {
      if (typeof property.type === "string") {
        const t = typesByName[property.type];
        if (t) {
          property.type = t;
        }
      }
    }
  }
}

export const types = [];
export const typesByName = {};
