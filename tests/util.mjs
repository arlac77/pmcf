export function assertObject(t, object, expected, name) {
  t.is(object.name, name);

  if (expected.instanceof) {
    t.true(object instanceof expected.instanceof);
  }

  for (const [k, v] of Object.entries(expected)) {
    switch (k) {
      case "name":
      case "instanceof":
        break;
      default:
        t.is(object[k], v);
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
