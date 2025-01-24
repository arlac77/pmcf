import test from "ava";
import { World } from "pmcf";

test("load all", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const location1 = await world.named("L1");
  t.is(location1.name, "L1");

  const host1 = await world.named("L1/host1");
  t.is(host1.name, "host1");

  const network1 = await world.named("L1/n1");
  t.is(network1.name, "n1");

  const host2 = await world.named("L1/n1/host2");
  t.is(host2.name, "host2");
});
