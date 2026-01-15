import { createReadStream } from "node:fs";
import { extractFunctions } from "npm-pkgbuild";

export async function loadHooks(packageData, file) {
  for await (const f of extractFunctions(createReadStream(file, "utf8"))) {
    addHook(packageData, f.name, f.body);
  }
}

export function addHook(packageData, name, content) {
  packageData.properties.hooks ||= {};

  const hook = packageData.properties.hooks[name];
  if (hook) {
    content = hook + "\n" + content;
  }

  packageData.properties.hooks[name] = content;

  return packageData.properties.hooks;
}
