import test from "ava";
import { World } from "../src/model.mjs";
import { assertObject, assertObjects } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Host basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  assertObject(
    t,
    await world.host(/*named*/ "L1/host1"),
    world1(world)["L1/host1"],
    "L1/host1"
  );
});

test("Host all", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await assertObjects(
    t,
    world.hosts(),
    world1(world, ["L1/n1/host2", "L1/host1"])
  );
});
