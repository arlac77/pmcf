import { decodeIPv4, decodeIPv6 } from "ip-utilties";
import { asIterator } from "./utils.mjs";

const typeOrder = {
  SOA: 0,
  NS: 1,
  MX: 2,
  A: 3,
  AAAA: 3,
  CNAME: 4,
  PTR: 5,
  HTTPS: 6,
  SRV: 7,
  TXT: 8
};

export function sortZoneRecords(a, b) {
  let order = typeOrder[a.type] - typeOrder[b.type];
  if (order) {
    return order;
  }

  const numSortable = record =>
    record.type === "PTR" && record.key.indexOf(".arpa") > 0;

  if (numSortable(a) && numSortable(b)) {
    const toNum = key => {
      const s = key.split(".");
      s.pop();
      s.pop();
      s.pop();

      return s
        .reverse()
        .reduce((a, c) => BigInt(parseInt(c, 16)) + 256n * 256n * a, 0n);
    };
    return Number(toNum(a.key) - toNum(b.key));
  }
  order = a.key.localeCompare(b.key);
  if (order) {
    return order;
  }

  return a.values[0] - b.values[0];
}

export function dnsFullName(name) {
  return name.endsWith(".") ? name : name + ".";
}

export function dnsRecordTypeForAddressFamily(family) {
  switch (family) {
    case "IPv4":
      return "A";
    case "IPv6":
      return "AAAA";
  }
}

export function DNSRecord(key, type, ...values) {
  let pad = "";

  switch (type) {
    case "MX":
      pad = "        ";
      break;

    case "A":
      values[0] = decodeIPv4(values[0]);
      break;
    case "AAAA":
      values[0] = decodeIPv6(values[0]);
      break;
  }

  values = values.map(v =>
    typeof v === "number" ? String(v).padStart(3) + pad : v
  );

  return {
    type,
    key,
    values,
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
        ? `${name}="${[...asIterator(value)].sort().join(",")}"`
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

export function dnsPriority(priority) {
  return Math.min(500 - (priority ?? 10), 65535);
}
