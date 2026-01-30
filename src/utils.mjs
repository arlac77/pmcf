import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

export function yesno(flag) {
  return flag ? "yes" : "no";
}

/**
 * Appends default domain if name does not already have a domain.
 * @param {string} name
 * @param {string} [defaultDomain]
 * @returns {string|undefined}
 */
export function domainName(name, defaultDomain) {
  const dcs = name.split(".");
  return defaultDomain === undefined || dcs.length > 1 || name === "localhost"
    ? name
    : [name, defaultDomain].join(".");
}

/**
 * Extracts domain name from a name.
 * @param {string} domainName
 * @param {string} [defaultDomain]
 * @returns {string|undefined}
 */
export function domainFromDominName(domainName, defaultDomain) {
  const dcs = domainName.split(".");

  if (dcs.length > 1) {
    dcs.shift();
    return dcs.join(".");
  }

  return defaultDomain;
}

export async function writeLines(dir, name, lines) {
  let data;

  switch (typeof lines) {
    case "undefined":
      return;
    case "string":
      data = lines;
      break;

    default:
      data = [...lines]
        .flat()
        .filter(line => line !== undefined)
        .map(l => l + "\n")
        .join("");
  }

  const full = join(dir, name);
  dir = dirname(full);
  name = basename(full);
  await mkdir(dir, { recursive: true });

  return writeFile(join(dir, name), data, "utf8");
}

/**
 *
 * @param {string} sectionName
 * @param {Object} values
 * @returns {Array<string>}
 */
export function sectionLines(sectionName, values) {
  const lines = [`[${sectionName}]`];

  for (const [name, value] of Object.entries(values)) {
    lines.push(`${name}=${value}`);
  }

  return lines;
}

export function* setionLinesFromPropertyIterator(properties) {
  for (const [name, value, path, attribute] of properties) {
    if (attribute.attributes) {
      yield `[${name}]`;
    } else {
      yield `${name}=${value}`;
    }
  }
}

export function bridgeToJSON(bridge) {
  return [...bridge].map(n => n.fullName || `(${n})`).sort();
}

/**
 * @param {any} value
 * @returns {Array<any>}
 */
export function asArray(value) {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

/**
 * @param {any} value
 * @returns {Iterable<any>}
 */
export function asIterator(value) {
  switch (typeof value) {
    case "undefined":
      return [];
    case "string":
      return [value];
  }

  if (typeof value[Symbol.iterator] === "function") {
    return value;
  }

  return asArray(value);
}

export const filterConfigurable = (name, attribute) =>
  !attribute.private & attribute.configurable;
