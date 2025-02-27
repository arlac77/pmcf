export const types = {};

export function addType(clazz) {
  const type = clazz.typeDefinition;

  types[type.name] = type;

  type.clazz = clazz;
}

export const primitives = new Set(["string", "number", "boolean"]);

export function resolveTypeLinks() {
  for (const type of Object.values(types)) {
    type.owners = type.owners.map(owner =>
      typeof owner === "string" ? types[owner] : owner
    );

    for (const [name, property] of Object.entries(type.properties)) {
      property.name = name;
      if (property.identifier) {
        type.identifier = property;
      }

      if (typeof property.type === "string") {
        if (!primitives.has(property.type)) {
          const type = types[property.type];
          if (type) {
            property.type = type;
          } else {
            console.error(
              "Unknown type",
              property.type,
              type.name,
              property.name
            );
          }
        }
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
