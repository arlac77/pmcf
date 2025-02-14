export function addType(clazz) {
  types.push(clazz);

  const typeDefinition = clazz.typeDefinition;
  typeDefinition.clazz = clazz;

  typesByName[typeDefinition.name] = clazz;
}

export const types = [];
export const typesByName = {};
