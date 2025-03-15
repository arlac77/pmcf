import { asArray, asIterator } from "./utils.mjs";

export function dnsFullName(name) {
  return name.endsWith(".") ? name : name + ".";
}

export function DNSRecord(key, type, ...values) {
  values = values.map(v => (typeof v === "number" ? String(v).padStart(3) : v));

  return {
    key,
    toString: (maxKeyLength, ttl) =>
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
/*
console.log(
  dnsFormatParameters(dnsMergeParameters({ alpn: "h2" }, { alpn: "h3" }))
);
*/