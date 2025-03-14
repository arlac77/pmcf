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
    .map(([name, value]) => (value !== undefined ? `${name}="${value}"` : name))
    .join(" ");
}
