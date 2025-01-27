import test from "ava";
import { World } from "pmcf";

test("Cluster basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const c1 = await world.named("L1/C1");

  t.is(c1.fullName, "L1/C1");
});
