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
  return [...bridge].map(n => n.fullName || `(${n})`).sort();
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

export function isLinkLocal(address) {
  return address.startsWith("fe80");
}

export function normalizeIPAddress(address) {
  address = address.replace(/\/\d+$/, "");
  if (isIPv4Address(address)) {
    return address;
  }
  const parts = address.split(":");
  const i = parts.indexOf("");
  if (i >= 0) {
    parts.splice(i, 1, ..."0".repeat(9 - parts.length));
  }
  return parts.map(s => s.padStart(4, "0")).join(":");
}

function encodeIPv4(address) {
  const octets = [0, 0, 0, 0];

  let i = 0;
  for (const a of address.split(/\./)) {
    octets[i++] = parseInt(a);
  }

  return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

function decodeIPv4(address, length = 32) {
  const octets = [
    (address >> 24) & 0xff,
    (address >> 16) & 0xff,
    (address >> 8) & 0xff,
    address & 0xff
  ];

  octets.length = Math.ceil(length / 8);

  return octets.join(".");
}

export function encodeIPv6(address) {
  let res = 0n;
  let shift = 128n;

  for (const word of normalizeIPAddress(address)
    .split(/\:/)
    .map(a => parseInt(a, 16))) {
    shift -= 16n;
    res += BigInt(word) << shift;
  }

  return res;
}

export function decodeIPv6(address, length = 128) {
  let words = [];
  let shift = 128n;

  for (let i = 0; i < length / 16; i++) {
    shift -= 16n;
    words.push(((address >> shift) & 0xffffn).toString(16).padStart(4, "0"));
  }

  return words.join(":");
}

export function normalizeCIDR(address) {
  let [prefix, prefixLength] = address.split(/\//);

  if (!prefixLength && isLinkLocal(address)) {
    prefix = "fe80::";
    prefixLength = 64;
  } else {
    if (prefixLength) {
      if (isIPv4Address(prefix)) {
        let n = encodeIPv4(prefix);
        n = n & (0xffffffff << (32 - prefixLength));
        prefix = decodeIPv4(n, prefixLength);
      } else {
        let n = encodeIPv6(prefix);
        n =
          n &
          (0xffffffffffffffffffffffffffffffffn <<
            (128n - BigInt(prefixLength)));
        prefix = decodeIPv6(n, prefixLength);
      }
    } else {
      return {};
    }
  }

  return { prefix, prefixLength, cidr: `${prefix}/${prefixLength}` };
}
