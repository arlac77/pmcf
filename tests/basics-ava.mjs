import test from "ava";
import { World } from "../src/model.mjs";

test("load Host", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const host = await world.host("L1/host1");
  const loction = await world.location("L1");

  t.is(host.name, "L1/host1");
  t.is(host.owner, world);
  t.is(host.location, loction);
  t.is(host.os, "linux");
});
