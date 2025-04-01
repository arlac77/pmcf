import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

export function domainName(name, defaultDomain) {
  const dcs = name.split(".");
  return defaultDomain === undefined || dcs.length > 1
    ? name
    : [name, defaultDomain].join(".");
}

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

export function isIPv4Address(address) {
  switch (typeof address) {
    case "string":
      return address.indexOf(".") >= 0;
  }

  return false;
}

export function generateEU64(mac) {
  //TODO
}

export function isIPv6Address(address) {
  return address.indexOf(":") >= 0;
}

export function isLinkLocal(address) {
  return address.startsWith("fe80");
}

export function isLocalhost(address) {
  const eaddr = encodeIP(address);
  return eaddr === IPV4_LOCALHOST || eaddr === IPV6_LOCALHOST;
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

const ipv4 = {
  separator: ".",
  length: 32,
  segmentLength: 8,
  segmentMask: 0xffn,
  mask: 0xffffffffn,
  base: 10
};
const ipv6 = {
  separator: ":",
  compressor: "::",
  length: 128,
  segmentLength: 16,
  segmentMask: 0xffffn,
  mask: 0xffffffffffffffffffffffffffffffffn,
  base: 16
};

function _decode(definition, address, length = definition.length) {
  let result = "";
  let compressed = 0;
  let shift = definition.length;
  let word;
  const last = length / definition.segmentLength;

  for (let i = 0, j = 0; i < last; j = j + 1, i = j) {
    for (; j < last; j++) {
      shift -= definition.segmentLength;
      word = (address >> BigInt(shift)) & definition.segmentMask;

      if (word !== 0n || !definition.compressor || compressed > 0) {
        break;
      }
    }

    if (j > i + 1) {
      compressed++;
      result += definition.compressor;
    } else {
      if (result.length > 0) {
        result += definition.separator;
      }
    }

    if (j < last) {
      result += word.toString(definition.base);
    }
  }

  return result;
}

export function _encode(definition, address) {
  if (typeof address !== "string") {
    return address;
  }

  let res = 0n;
  let shift = BigInt(definition.length);

  for (const word of normalizeIPAddress(address)
    .split(definition.separator)
    .map(a => parseInt(a, definition.base))) {
    shift -= BigInt(definition.segmentLength);
    res += BigInt(word) << shift;
  }

  return res;
}

export function decodeIPv6(address, length) {
  return _decode(ipv6, address, length);
}

export function encodeIPv6(address) {
  return _encode(ipv6, address);
}

export function decodeIPv4(address, length) {
  return _decode(ipv4, address, length);
}

export function encodeIPv4(address) {
  return _encode(ipv4, address);
}

export function decodeIP(address, length) {
  return _decode(isIPv4Address(address) ? ipv4 : ipv6, address, length);
}

export function encodeIP(address) {
  return _encode(isIPv4Address(address) ? ipv4 : ipv6, address);
}

export function formatCIDR(address, subnet) {
  return subnet ? `${address}/${subnet.prefixLength}` : address;
}

export function normalizeCIDR(address) {
  let [prefix, prefixLength] = address.split(/\//);

  if (!prefixLength && isLinkLocal(address)) {
    prefix = "fe80::";
    prefixLength = 64;
  } else {
    const definition = isIPv6Address(prefix) ? ipv6 : ipv4;
    let n = _encode(definition, prefix);

    if (prefixLength) {
      n = n & (definition.mask << BigInt(definition.length - prefixLength));
      prefix = _decode(definition, n, prefixLength);
    } else {
      if (n === IPV4_LOCALHOST) {
        prefixLength = 8;
        prefix = _decode(definition, n, prefixLength);
      } else if (n === IPV6_LOCALHOST) {
        prefixLength = 128;
        prefix = _decode(definition, n, prefixLength);
      } else {
        return {};
      }
    }
  }

  return { prefix, prefixLength, cidr: `${prefix}/${prefixLength}` };
}

export function hasWellKnownSubnet(address) {
  const n = encodeIP(address);
  return n === IPV4_LOCALHOST || n === IPV6_LOCALHOST || isLinkLocal(address);
}

export const IPV4_LOCALHOST = _encode(ipv4, "127.0.0.1");
export const IPV6_LOCALHOST = _encode(ipv6, "::1");
export const IPV6_LINK_LOCAL_BROADCAST = _encode(ipv6, "ff02::1");
export const IPV6_ROUTER_BROADCAST = _encode(ipv6, "ff02::2");
