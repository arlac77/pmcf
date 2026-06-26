import test from "ava";
import { InitializationContext, Network, assign, networks_attribute } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Network basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();
  await assertObject(
    t,
    await ic.root.named("/L1/n1"),
    root1(ic.root, "/L1/n1")
  );
});

test("Network addresses", t => {
  const ic = new InitializationContext("/");
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
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);
  t.true(s1.networks.has(n1));

  const s2 = n1.subnets.get("fe80::/64");
  t.is(s2.name, "fe80::/64");
  t.is(s2.prefixLength, 64);
  t.true(s2.networks.has(n1));
});

test("Network bridges", t => {
  const ic = new InitializationContext("/");

  /*
  const n1 = new Network(owner, { name: "n1" });
  const n2 = new Network(owner, { name: "n2", bridge: "n1" });
  t.true(n2.bridge.has(n1));
  t.true(n1.bridge.has(n2));
  */

  const n3 = new Network();
  ic.read(n3, { name: "n3", bridge: "/n4" });
  assign(networks_attribute, ic.root, n3);
  const n4 = new Network();
  ic.read(n4, { name: "n4" });
  assign(networks_attribute, ic.root, n4);

  ic.resolveOutstanding();

  t.true(n4.bridge.has(n3));
  t.true(n3.bridge.has(n4));
});
