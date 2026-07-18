import test from "ava";
import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import {
  InitializationContext,
  Network,
  Subnet,
  assign,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6,
  subnets_attribute,
  networks_attribute
} from "pmcf";
import { asArray } from "../src/utils.mjs";

test("Subnet owner", t => {
  const ic = new InitializationContext();
  const s1 = new Subnet("10.0.0.77/16");

  assign(subnets_attribute, ic.root, s1);
  t.is(ic.root.subnets.get("10.0/16"), s1);

  const n1 = new Network();
  ic.read(n1, { name: "n1" });
  assign(networks_attribute, ic.root, n1);

  const n2 = new Network();
  ic.read(n2, { name: "n2" });
  assign(networks_attribute, ic.root, n2);

  const s2 = new Subnet("192.168.1/24");
  assign(subnets_attribute, n1, s2);

  t.is(ic.root.subnets.get("192.168.1/24"), undefined);
  t.is(n1.subnets.get("192.168.1/24"), s2);
  t.is(n2.subnets.get("192.168.1/24"), undefined);
});

test("Subnet ipv6", t => {
  const s1 = new Subnet("fe80::1e57:3eff:fe22:9a8f/64");

  t.is(s1.name, "fe80::/64");
  t.is(s1.prefixLength, 64);
  t.is(s1.family, FAMILY_IPV6);

  t.true(s1.matchesAddress("fe80::1e57:3eff:fe22:9a8f"));
  t.true(s1.matchesAddress("fe80:0000:0000:0000:1e57:3eff:fe22:9a8e"));
  t.false(s1.matchesAddress("fe81:0000:0000:0000:1e57:3eff:fe22:9a8f"));
  t.false(s1.matchesAddress("fe81::1e57:3eff:fe22:9a8f"));
});

test("Subnet match with prefix length", t => {
  const s1 = new Subnet("192.168.1/24");
  t.true(s1.matchesAddress("192.168.1.60"));
  t.true(s1.matchesAddress("192.168.1.60/30"));
});

function st(t, address, expected) {
  const subnet = address instanceof Subnet ? address : new Subnet(address);

  for (const property of [
    "address",
    "longAddress",
    "prefixLength",
    "family",
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
  family: FAMILY_IPV4,
  matches: ["127.0.01"],
  notMatches: ["10.2.0.77"]
  // addressRange: ["10.0.0.0", "10.0.255.255"]
});

test(st, SUBNET_LOCALHOST_IPV6, {
  address: "::1/128",
  longAddress: "::1/128",
  prefixLength: 128,
  family: FAMILY_IPV6,
  //matches: ["127.0.01"],
  //notMatches: ["10.2.0.77"]
  // addressRange: ["10.0.0.0", "10.0.255.255"]
});

test(st, "10.0.0.77/16", {
  address: "10.0/16",
  longAddress: "10.0.0.0/16",
  prefixLength: 16,
  family: FAMILY_IPV4,
  matches: ["10.0.0.77"],
  notMatches: ["10.2.0.77"],
  addressRange: ["10.0.0.1", "10.0.255.254"]
});

test(st, "192.168.1/24", {
  address: "192.168.1/24",
  longAddress: "192.168.1.0/24",
  prefixLength: 24,
  family: FAMILY_IPV4,
  matches: ["192.168.1.77"],
  notMatches: ["192.168.2.77"],
  addressRange: ["192.168.1.1", "192.168.1.254"]
});

test(st, "192.168.1.61/30", {
  address: "192.168.1.60/30",
  longAddress: "192.168.1.60/30",
  prefixLength: 30,
  family: FAMILY_IPV4,
  // matches: ["192.168.1.62/30"],
  notMatches: ["192.168.2.77"],
  addressRange: ["192.168.1.61", "192.168.1.62"]
});
