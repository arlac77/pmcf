import test from "ava";
import { World } from "pmcf";
import { assertObject, assertObjects } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Cluster basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  world.execFinalize();

  await assertObject(t, await world.named("L1/C1"), world1(world, "L1/C1"));
});
