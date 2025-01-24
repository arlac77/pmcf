import test from "ava";
import { World, Owner, Network } from "pmcf";
import { assertObject } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Network basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await assertObject(t, await world.named("L1/n1"), world1(world, "L1/n1"));
});

test("Network bridges", t => {
  const owner = new Owner();

  const n1 = new Network(owner, { name: "n1"  });

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
