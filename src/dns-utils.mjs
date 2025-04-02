import {
  asIterator,
  decodeIPv6,
  encodeIPv6,
  normalizeIPAddress
} from "./utils.mjs";

export function dnsFullName(name) {
  return name.endsWith(".") ? name : name + ".";
}

export function DNSRecord(key, type, ...values) {
  let pad = "";

  switch (type) {
    case "MX":
      pad = "        ";
      break;

    case "A":
      values[0] = normalizeIPAddress(values[0]);
      break;
    case "AAAA":
      values[0] = decodeIPv6(encodeIPv6(values[0]));
      break;
  }

  values = values.map(v =>
    typeof v === "number" ? String(v).padStart(3) + pad : v
  );

  return {
    key,
    toString: (maxKeyLength = 0, ttl = "1W") =>
      `${key.padEnd(maxKeyLength, " ")} ${ttl} IN ${type.padEnd(
        5,
        " "
      )} ${values.join(" ")}`
  };
}

export function dnsFormatParameters(parameters) {
  return Object.entries(parameters)
    .map(([name, value]) =>
      value !== undefined && [...asIterator(value)].length > 0
        ? `${name}="${[...asIterator(value)].join(",")}"`
        : name
    )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .join(" ");
}

export function dnsMergeParameters(a, b) {
  return Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map(key => [
      key,
      new Set(asIterator(a[key])).union(new Set(asIterator(b[key])))
    ])
  );
}
