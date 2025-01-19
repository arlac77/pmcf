import test from "ava";
import {
  World,
  Host,
  Location,
  Network,
  Service,
  Subnet,
  Base
} from "../src/model.mjs";

test("types", t => {
  t.is(World.types.location, Location);
  t.is(World.types.network, Network);
  t.is(World.types.subnet, Subnet);
  t.is(World.types.service, Service);
  t.is(World.types.host, Host);
});

test("world basics", async t => {
  const world = new World("/somwhere");
  t.is(world.typeName, "world");
  t.is(world.directory, "/somwhere");
  t.is(world.name, "");
  t.is(world.fullName, "");
  t.is(await world.load(""),world);
});

test("baseName", t => {
  t.is(Base.baseName("abc"), "abc");
  t.is(Base.baseName("abc/def"), "abc/def");
  t.is(Base.baseName("abc/def.json"), "abc");
});

test("directory & name", t => {
  const world = new World("/somwhere");

  const l1 = new Location(world, { name: "l1" });
  t.is(l1.directory, "/somwhere/l1");
  t.is(l1.name, "l1");
  t.is(l1.fullName, "l1");
  t.is(l1.world, world);

  const h1 = new Location(l1, { name: "h1" });
  t.is(h1.directory, "/somwhere/l1/h1");
  t.is(h1.name, "h1");
  t.is(h1.fullName, "l1/h1");
  t.is(h1.world, world);

  const h2 = new Location(l1, { name: "l2/h2" });
  t.is(h2.directory, "/somwhere/l1/l2/h2");
  t.is(h2.name, "l2/h2");
  t.is(h2.fullName, "l1/l2/h2");
  t.is(h2.world, world);
});
