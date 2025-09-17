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
        if (filter[key] === undefined || filter[key] === object[key]) {
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
            let m = filter[key].match(/^([=><!]+)(\d+)/);
            if (m) {
              return compare(m[1], key, parseInt(m[2]));
            }

            m = filter[key].match(/^\[(\d+):(\d+)\]/);
            if (m) {
              const lower = parseInt(m[1]);
              const upper = parseInt(m[2]);
              return lower <= object[key] && upper >= object[key];
            }
        }
        return false;
      };
      for (let t = type; t; t = t.extends) {
        for (const [name, attribute] of Object.entries(t.attributes)) {
          switch (attribute.type[0]) {
            case "boolean":
              if (filter[name] !== undefined && filter[name] != object[name]) {
                continue advance;
              }
              break;

            case "number":
              if (!filterNumber(name)) {
                continue advance;
              }
              break;
            case "string":
              if (attribute.collection && filter[name] !== undefined) {
                const value = object[name];

                if (value instanceof Set && value.has(filter[name])) {
                  break;
                }
                continue advance;
              } else if (!filterString(name)) {
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
