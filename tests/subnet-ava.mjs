import test from "ava";
import { Root, Network, Subnet } from "pmcf";

test("Subnet owner", t => {
  const root = new Root();

  const s1 = new Subnet(root, {
    name: "10.0.0.77/16"
  });

  const n1 = new Network(root, { name: "n1" });

  const s2 = new Subnet(n1, {
    name: "192.168.1/24"
  });

  t.deepEqual(
    [...root.subnets()].map(s => s.name),
    ["10.0/16", "192.168.1/24"]
  );
  t.deepEqual(
    [...n1.subnets()].map(s => s.name),
    ["10.0/16", "192.168.1/24"]
  );
});

test("Subnet ipv4", t => {
  const root = new Root();

  const s1 = new Subnet(root, {
    name: "10.0.0.77/16"
  });

  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  t.true(s1.matchesAddress("10.0.0.77"));
  t.false(s1.matchesAddress("10.2.0.77"));

  t.false(s1.isLinkLocal);
});

test("Subnet ipv6", t => {
  const root = new Root();
  const s1 = new Subnet(root, {
    name: "fe80::1e57:3eff:fe22:9a8f/64"
  });

  t.is(s1.name, "fe80:0000:0000:0000/64");
  t.is(s1.prefixLength, 64);

  t.true(s1.matchesAddress("fe80:0000:0000:0000:1e57:3eff:fe22:9a8f"));
  t.false(s1.matchesAddress("fe81:0000:0000:0000:1e57:3eff:fe22:9a8f"));
  // t.false(s1.matchesAddress("fe80:0000:0000:0000:1e57:3eff:fe22:9a8e"));

  t.true(s1.isLinkLocal);
});
