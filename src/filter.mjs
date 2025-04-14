export function* objectFilter(type, objects, filter) {
  if (filter) {
    advance: for (const object of objects) {
      const compare = (op, key, value) => {
        switch (op) {
          case "=":
            return object[key] == value;
          case "!=":
            return object[key] != value;
          case "<":
            return object[key] < value;
          case "<=":
            return object[key] <= value;
          case ">":
            return object[key] > value;
          case ">=":
            return object[key] >= value;
        }
        return false;
      };

      const filterString = key => {
        if (filter[key] === undefined) {
          return true;
        }
        if (filter[key] === object[key]) {
          return true;
        }

        for (const value of filter[key].split("|")) {
          if (object[key] === value) {
            return true;
          }
        }

        return false;
      };

      const filterNumber = key => {
        switch (typeof filter[key]) {
          case "undefined":
            return true;
          case "number":
            return filter[key] === object[key];
          case "string":
            const m = filter[key].match(/^([=><!]+)(\d+)/);
            if (m) {
              return compare(m[1], key, parseInt(m[2]));
            }
        }
        return false;
      };
      for (let t = type; t; t = t.extends) {
        for (const property of Object.values(t.properties)) {
          switch (property.type[0]) {
            case "boolean":
              if (
                filter[property.name] !== undefined &&
                filter[property.name] != object[property.name]
              ) {
                continue advance;
              }
              break;

            case "number":
              if (!filterNumber(property.name)) {
                continue advance;
              }
              break;
            case "string":
              if (!filterString(property.name)) {
                continue advance;
              }
              break;
          }
        }
      }
      yield object;
    }
  } else {
    yield* objects;
  }
}
