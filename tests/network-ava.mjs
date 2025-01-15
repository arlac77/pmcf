import test from "ava";
import { World } from "../src/model.mjs";
import { assertObject } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Network basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  assertObject(t, await world.named("L1/n1"), world1(world)["L1/n1"], "L1/n1");
});
