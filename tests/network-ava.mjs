import test from "ava";
import { Root, Network } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Network basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObject(t, await root.named("L1/n1"), root1(root, "L1/n1"));
});

test("Network addresses", t => {
  const owner = new Root();

  const n1 = new Network(owner, { name: "n1", ipAddresses: "10.0.0/16" });

  t.is(n1.prefixLength, 16);
  t.deepEqual(n1.ipAddresses, ["10.0.0/16"]);
});

test("Network bridges", t => {
  const owner = new Root();

  const n1 = new Network(owner, { name: "n1" });

  /*
  const n2 = new Network(owner, { name: "n2", bridge: "n1" });

  t.true(n2.bridge.has(n1));
  t.true(n1.bridge.has(n2));
*/
  const n3 = new Network(owner, { name: "n3", bridge: "n4" });
  const n4 = new Network(owner, { name: "n4" });

  owner.execFinalize();

  t.true(n4.bridge.has(n3));
  t.true(n3.bridge.has(n4));
});
