import test from "ava";
import { assertObject, assertObjects } from "./util.mjs";
import { world1 } from "./fixtures.mjs";
import { World } from "../src/model.mjs";

test("Location basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  assertObject(t, await world.named("L1"), ...world1(world, "L1"));
});

test("Location all", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await assertObjects(t, world.locations(), world1(world, ["L1", "L2"]));
});
