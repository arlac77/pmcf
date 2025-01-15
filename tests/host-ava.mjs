import test from "ava";
import { World } from "../src/model.mjs";
import { assertObject } from "./util.mjs";
import { world1 } from "./fixtures.mjs";

test("Host basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  assertObject(t, await world. host  /*named*/ ("L1/host1"), world1(world)["L1/host1"], "L1/host1");
});
