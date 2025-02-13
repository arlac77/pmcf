export function addType(clazz) {
  types.push(clazz);
  typesByName[clazz.typeName] = clazz;
}

export const types = [];
export const typesByName = {};
