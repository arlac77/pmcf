
export function addHook(packageData, name, content) {
  packageData.properties.hooks ??= {};

  const hook = packageData.properties.hooks[name];
  if (hook) {
    content = hook + "\n" + content;
  }

  packageData.properties.hooks[name] = content;

  return packageData.properties.hooks;
}
