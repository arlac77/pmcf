export async function assertObject(t, object, expected, path = []) {
  const visited = new Set();
  return _assertObject(t, visited, object, expected, path);
}

function pathToString(path) {
  return path.map(p => p?.name || p).join(".");
}

async function _assertObject(t, visited, object, expected, path = []) {
  t.log(`${pathToString(path)}: ${object} <> ${expected}`);

  switch (typeof expected) {
    case "undefined":
    case "string":
    case "number":
    case "boolean":
      t.is(object, expected, `${pathToString(path)}: is`);
      return;
  }

  if (visited.has(object)) {
    return;
  }

  visited.add(object);

  t.false(object === undefined, pathToString(path));

  if (Array.isArray(expected)) {
    let i = 0;

    object = [...object].sort((a, b) =>
      a.name ? a.name.localeCompare(b.name) : a.localeCompare(b)
    );

    for (const o of object) {
      t.log(`${pathToString(path)}: ${o}`);
      if (i >= expected.length) {
        break;
      }
      t.true(i < expected.length, `iterate ${i} >= ${expected.length}: ${o}`);
      await _assertObject(t, visited, o, expected[i], [
        ...path,
        o?.name ? o : i
      ]);
      i++;
    }
    return;
  }

  for (const [k, v] of Object.entries(expected)) {
    switch (k) {
      case "instanceof":
        t.true(
          object instanceof expected.instanceof,
          `${pathToString([...path, k])}: ${expected.instanceof.name} (${
            object?.constructor.name
          })`
        );

      case "services":
        for (const [name, sd] of Object.entries(v)) {
          const service = [...object.findServices(`name="${name}"`)][0];
          _assertObject(t, visited, service, sd, [...path, name]);
        }
        break;

      case "extends":
        t.deepEqual(
          object.extends.map(a => a.fullName).sort(),
          v,
          `${pathToString(path)}: extends`
        );
        break;
      default: {
        let o;
        if (object instanceof Map) {
          o = object.get(k);
        } else {
          o = object[k];
          if (typeof o === "function") {
            o = await object[k]();
          }
        }
        await _assertObject(t, visited, o, v, [...path, k]);
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
