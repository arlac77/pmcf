import test from "ava";
import { assertObject, assertObjects } from "./util.mjs";
import { world1 } from "./fixtures.mjs";
import { World } from "../src/model.mjs";

test("Location basics", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await assertObject(t, await world.named("L1"), world1(world, "L1"), ["L1"]);
});

test("Location all", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await assertObjects(t, world.locations(), world1(world, ["L1", "L2"]));
});

test("Location dns", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const l1 = await world.named("L1");

  const dnsServices = await Array.fromAsync(l1.dns.services());

  t.deepEqual(
    dnsServices.map(s => s.ipAddresses[0]).sort(),
    ["1.1.1.1", "192.168.1.1", "192.168.1.2", "8.8.8.8"].sort()
  );
});
