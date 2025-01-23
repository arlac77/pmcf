import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function writeLines(dir, name, lines) {
  await mkdir(dir, { recursive: true });
  return writeFile(
    join(dir, name),
    [...lines]
      .flat()
      .filter(line => line !== undefined)
      .map(l => l + "\n")
      .join(""),
    "utf8"
  );
}

export function sectionLines(sectionName, values) {
  const lines = [`[${sectionName}]`];

  for (const [name, value] of Object.entries(values)) {
    lines.push(`${name}=${value}`);
  }

  return lines;
}

export function bridgeToJSON(bridge) {
  return [...bridge].map(n => n.name || `(${n})`).sort();
}

export function asArray(value) {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

export function isIPv4Address(address) {
  return address.indexOf(".") >= 0;
}

export function isIPv6Address(address) {
  return address.indexOf(":") >= 0;
}
