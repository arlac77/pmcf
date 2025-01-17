import test from "ava";
import { World, Owner, Network } from "../src/model.mjs";
import { assertObject } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Network basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await assertObject(t, await world.named("L1/n1"), world1(world, "L1/n1"));
});

test("bridges", t => {
  const owner = new Owner();

  const n1 = new Network(owner, { name: "n1", bridge: "n2" });
  const n2 = new Network(owner, { name: "n2", bridge: ["n1"] });

  t.true(n2.bridge.has(n1));
  t.true(n1.bridge.has(n2));
});
