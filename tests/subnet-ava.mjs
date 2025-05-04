import test from "ava";
import {
  Root,
  Network,
  Subnet,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6
} from "pmcf";
import { asArray } from "../src/utils.mjs";

test("Subnet owner", t => {
  const root = new Root("/");

  const s1 = new Subnet(root, "10.0.0.77/16");

  const n1 = new Network(root, { name: "n1" });
  const n2 = new Network(root, { name: "n2" });

  t.is(root.subnetNamed("10.0/16"), s1);
  t.is(n1.subnetNamed("10.0/16"), s1);

  const s2 = new Subnet(n1, "192.168.1/24");

  t.is(root.subnetNamed("192.168.1/24"), undefined);
  t.is(n1.subnetNamed("192.168.1/24"), s2);
  t.is(n2.subnetNamed("192.168.1/24"), undefined);

  t.deepEqual(
    [...root.subnets()].map(s => s.name),
    ["10.0/16"]
  );
  t.deepEqual(
    [...n2.subnets()].map(s => s.name),
    ["10.0/16"]
  );

  t.deepEqual(
    [...n1.subnets()].map(s => s.name),
    ["10.0/16", "192.168.1/24"]
  );
});

test("Subnet ipv6", t => {
  const root = new Root("/");
  const s1 = new Subnet(root, "fe80::1e57:3eff:fe22:9a8f/64");

  t.is(s1.name, "fe80::/64");
  t.is(s1.prefixLength, 64);
  t.is(s1.family, "IPv6");

  t.true(s1.matchesAddress("fe80::1e57:3eff:fe22:9a8f"));
  t.true(s1.matchesAddress("fe80:0000:0000:0000:1e57:3eff:fe22:9a8e"));
  t.false(s1.matchesAddress("fe81:0000:0000:0000:1e57:3eff:fe22:9a8f"));
  t.false(s1.matchesAddress("fe81::1e57:3eff:fe22:9a8f"));

  t.true(s1.isLinkLocal);
});

function st(t, address, expected) {
  const subnet =
    address instanceof Subnet ? address : new Subnet(new Root("/"), address);

  for (const property of [
    "address",
    "longAddress",
    "prefixLength",
    "family",
    "isLinkLocal",
    "addressRange"
  ]) {
    if (expected[property] !== undefined) {
      if (Array.isArray(expected[property])) {
        t.deepEqual(
          subnet[property],
          expected[property],
          `${property} ${address} ${expected[property]}`
        );
      } else {
        t.is(subnet[property], expected[property], `${property} ${address}`);
      }
    }
  }

  for (const a of asArray(expected.matches)) {
    t.true(subnet.matchesAddress(a), `matches ${address} ${a}`);
  }

  for (const a of asArray(expected.notMatches)) {
    t.false(subnet.matchesAddress(a), `not matches ${address} ${a}`);
  }
}

st.title = (providedTitle = "subnet", address, expected) =>
  `${providedTitle} ${address} => ${JSON.stringify(expected)}`.trim();

test(st, SUBNET_LOCALHOST_IPV4, {
  address: "127/8",
  longAddress: "127.0.0.0/8",
  prefixLength: 8,
  family: "IPv4",
  isLinkLocal: false,
  matches: ["127.0.01"],
  notMatches: ["10.2.0.77"]
  // addressRange: ["10.0.0.0", "10.0.255.255"]
});

test(st, SUBNET_LOCALHOST_IPV6, {
  address: "::1/128",
  longAddress: "::1/128",
  prefixLength: 128,
  family: "IPv6",
  isLinkLocal: false
  //matches: ["127.0.01"],
  //notMatches: ["10.2.0.77"]
  // addressRange: ["10.0.0.0", "10.0.255.255"]
});

test(st, "10.0.0.77/16", {
  address: "10.0/16",
  longAddress: "10.0.0.0/16",
  prefixLength: 16,
  family: "IPv4",
  isLinkLocal: false,
  matches: ["10.0.0.77"],
  notMatches: ["10.2.0.77"],
  addressRange: ["10.0.0.1", "10.0.255.254"]
});

test(st, "192.168.1/24", {
  address: "192.168.1/24",
  longAddress: "192.168.1.0/24",
  prefixLength: 24,
  family: "IPv4",
  isLinkLocal: false,
  matches: ["192.168.1.77"],
  notMatches: ["192.168.2.77"],
  addressRange: ["192.168.1.1", "192.168.1.254"]
});

test(st, "192.168.1.61/30", {
  address: "192.168.1.60/30",
  longAddress: "192.168.1.60/30",
  prefixLength: 30,
  family: "IPv4",
  isLinkLocal: false,
  // matches: ["192.168.1.62/30"],
  notMatches: ["192.168.2.77"],
  addressRange: ["192.168.1.61", "192.168.1.62"]
});
