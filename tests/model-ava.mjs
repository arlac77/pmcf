import test from "ava";
import { World } from "../src/model.mjs";
import { assertObject } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Model basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  assertObject(t, await world.named("model/m1"), world1(world)["model/m1"], "model/m1");
});
