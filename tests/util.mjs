export async function assertObject(t, object, expected, path = []) {
  t.truthy(object, `${path.join("/")}: present`);

  for (const [k, v] of Object.entries(expected)) {
    switch (k) {
      case "instanceof":
        t.true(
          object instanceof expected.instanceof,
          `${[...path, k].join("/")}: ${expected.instanceof.name}`
        );
        break;
      case "services":
        for (const [name, sd] of Object.entries(v)) {
          const service = [...object.services({ name })][0];
          assertObject(t, service, sd, [...path, name]);
        }
        break;
      default:
        let value = object[k];

        if (typeof value === "function") {
          value = (await Array.fromAsync(object[k]())).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        }
        if (Array.isArray(v)) {
          let i = 0;
          for (const vv of v.sort((a, b) => a.name.localeCompare(b.name))) {
            await assertObject(t, value[i], vv, [...path, k, i]);
            i++;
          }
        } else {
          if (typeof v === "object") {
            if(v.name) {
              t.is(value.name, v.name, `${path.join("/")}: ${k}.name`);
            }
            else {
              assertObject(t, value, v, [...path, k]);
            }
          } else {
            t.is(value, v, `${[...path, k].join("/")}:`);
          }
        }
    }
  }
}

export async function assertObjects(t, iterator, expected, path = []) {
  const objects = new Map();

  for await (const i of iterator) {
    objects.set(i.fullName, i);
  }

  for (const [name, exp] of Object.entries(expected)) {
    await assertObject(t, objects.get(name), exp, [...path, name]);
  }
}
