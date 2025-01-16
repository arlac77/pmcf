export async function assertObject(t, object, expected, path = []) {
  for (const [k, v] of Object.entries(expected)) {
    switch (k) {
      case "instanceof":
        t.true(
          object instanceof expected.instanceof,
          `${[...path, k].join("/")}: ${expected.instanceof.name}`
        );
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
          if (typeof v === "object" && v.name) {
            t.is(value.name, v.name, `${path.join("/")}: ${k}.name`);
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
    objects.set(i.name, i);
  }

  for (const [name, exp] of Object.entries(expected)) {
    await assertObject(t, objects.get(name), exp, [...path, exp]);
  }
}
