import { createReadStream } from "node:fs";
import { extractFunctions } from "npm-pkgbuild";

export async function loadHooks(hooks, file) {
  for await (const f of extractFunctions(createReadStream(file, "utf8"))) {
    addHook(hooks, f.name, f.body);
  }

  return hooks;
}

export function addHook(hooks, name, content) {
  const hook = hooks[name];
  if (hook) {
    content = hook + "\n" + content;
  }

  hooks[name] = content;

  return hooks;
}
