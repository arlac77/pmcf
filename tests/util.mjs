export function assertObject(t, object, expected, name) {
  t.is(object?.name, name, name);

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
        if(typeof v === "object" && v.name ) {
          t.is(object[k].name, v.name, `${name}: ${k}.name`);
        }
        else {
          t.is(object[k], v, `${name}: ${k}`);
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
    assertObject(t, objects.get(name), exp, name);
  }
}
