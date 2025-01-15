import test from "ava";
import { World } from "../src/model.mjs";

test("load all", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);
  await world.load();

  const location1 = await world.named("L1");
  t.is(location1.name, "L1");

  const host1 = await world.named("L1/host1");
  t.is(host1.name, "L1/host1");

  const network1 = await world.named("L1/n1");
  t.is(network1.name, "L1/n1");

  const host2 = await world.named("L1/n1/host2");
  t.is(host2.name, "L1/n1/host2");
});

test("load location Host", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const host = await world.host("L1/host1");
  const loction = await world.location("L1");

  t.is(host.name, "L1/host1");
 // t.is(host.directory, "L1/host1");
  t.is(host.owner, world);
  t.is(host.location, loction);
  t.is(host.os, "linux");
});

test("load location network Host", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const host = await world.host("L1/n1/host2");
  const loction = await world.location("L1");

  t.is(host.name, "L1/n1/host2");
 // t.is(host.directory, "L1/n1/host2");
  t.is(host.owner, world);
  t.is(host.location, loction);
  t.is(host.os, "linux");
});
