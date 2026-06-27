import test from "ava";
import {
  InitializationContext,
  Network,
  assign,
  networks_attribute
} from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Network load", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const n1 = ic.root.named("/L1/n1");
  await assertObject(t, n1, root1(ic.root, "/L1/n1"));
});

test("Network addresses", t => {
  const ic = new InitializationContext();
  const n1 = new Network();
  ic.read(n1, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"],
    kind: "ethernet",
    scope: "global"
  });
  assign(networks_attribute, ic.root, n1);

  t.is(n1.name, "n1");
  t.is(n1.kind, "ethernet");
  t.is(n1.scope, "global");

  const s1 = n1.subnets.get("10.0/16");
  t.true(s1.networks.has(n1));
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnets.get("fe80::/64");
  t.true(s2.networks.has(n1));
  t.is(s2.name, "fe80::/64");
  t.is(s2.prefixLength, 64);
});

test("Network bridges", t => {
  const ic = new InitializationContext();

  const n1 = new Network();
  ic.read(n1, { name: "n1", bridges: "/n2", hosts: { n1h1: {} } });
  assign(networks_attribute, ic.root, n1);
  const n1h1 = n1.named("n1h1");

  const n2 = new Network();
  ic.read(n2, { name: "n2", hosts: { n2h1: {} } });
  assign(networks_attribute, ic.root, n2);
  const n2h1 = n2.named("n2h1");

  ic.resolveOutstanding();

  //console.log(n1.bridges);
  //console.log(n2.bridges);
  //console.log([...n1.bridges].map(n => n.name));
  //console.log([...n1.hosts].map(n => n.name));

  t.true(n1.bridges.has(n2));
  t.true(n2.bridges.has(n1));

  t.deepEqual([...n1.hosts.values()], [n1h1, n2h1]);
  t.is(n1.hosts.get("n1h1"), n1h1);
  t.is(n1.hosts.get("n2h1"), n2h1);

  t.is(n2.hosts.get("n1h1"), n1h1);
  t.is(n2.hosts.get("n2h1"), n2h1);
});
