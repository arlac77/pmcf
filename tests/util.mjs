export async function assertObject(t, object, expected, name) {
  if (name) {
    t.is(object?.name, name, name);
  }

  for (const [k, v] of Object.entries(expected)) {
    switch (k) {
      case "name":
        break;
      case "instanceof":
        t.true(
          object instanceof expected.instanceof,
          `instanceof ${expected.instanceof.name}`
        );
        break;
      default:
        let value = object[k];

        if (typeof value === "function") {
          value = object[k]();
          if (value.next) {
            /*const result = [];
            for await( const x of value) {
              result.push(x);
            }

            value = result;
            */
            //console.log("ASYNC ITER",await value.next());
            const res = await value.next();
            value = res.value;
            value = value ? [value] : [];
          }
        }
        if (Array.isArray(v)) {
          let i = 0;
          for (const vv of v) {
            await assertObject(t, value[i], vv);
            i++;
          }
        } else {
          if (typeof v === "object" && v.name) {
            t.is(value.name, v.name, `${name}: ${k}.name`);
          } else {
            t.is(value, v, `${name}: ${k}`);
          }
        }
    }
  }
}

export async function assertObjects(t, iterator, expected) {
  const objects = new Map();

  for await (const i of iterator) {
    objects.set(i.name, i);
  }

  for (const [name, exp] of Object.entries(expected)) {
    await assertObject(t, objects.get(name), exp, name);
  }
}
