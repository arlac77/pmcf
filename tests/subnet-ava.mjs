import test from "ava";
import { Root, Network, Subnet } from "pmcf";

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

test("Subnet localhost", t => {
  const root = new Root("/");
  const s1 = new Subnet(root, "127/8");

  t.is(s1.name, "127/8");
  t.is(s1.prefixLength, 8);

  t.true(s1.matchesAddress("127.0.01"));
  t.false(s1.matchesAddress("10.2.0.77"));
});

test("Subnet ipv4", t => {
  const root = new Root("/");
  const s1 = new Subnet(root, "10.0.0.77/16");

  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);
  t.deepEqual(s1.addressRange, ["10.0.0.0", "10.0.255.255"]);

  t.true(s1.isIPv4);
  t.false(s1.isIPv6);

  t.true(s1.matchesAddress("10.0.0.77"));
  t.false(s1.matchesAddress("10.2.0.77"));

  t.false(s1.isLinkLocal);
});

test("Subnet ipv6", t => {
  const root = new Root("/");
  const s1 = new Subnet(root, "fe80::1e57:3eff:fe22:9a8f/64");

  t.is(s1.name, "fe80::/64");
  t.is(s1.prefixLength, 64);
  t.false(s1.isIPv4);
  t.true(s1.isIPv6);

  t.true(s1.matchesAddress("fe80::1e57:3eff:fe22:9a8f"));
  t.false(s1.matchesAddress("fe81:0000:0000:0000:1e57:3eff:fe22:9a8f"));
  // t.false(s1.matchesAddress("fe80:0000:0000:0000:1e57:3eff:fe22:9a8e"));

  t.true(s1.isLinkLocal);
});
