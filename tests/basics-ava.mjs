import test from "ava";
import {
  World,
  Host,
  Location,
  Network,
  Service,
  Subnet
} from "../src/model.mjs";

test("types", t => {
  t.is(World.types.location, Location);
  t.is(World.types.network, Network);
  t.is(World.types.subnet, Subnet);
  t.is(World.types.service, Service);
  t.is(World.types.host, Host);
});

test("directory", t => {
  const world = new World("/somwhere");

  t.is(world.directory, "/somwhere");

  const l1 = new Location(world, { name: "l1" });

  t.is(l1.directory, "/somwhere/l1");

  const h1 = new Location(l1, { name: "h1" });

  t.is(h1.directory, "/somwhere/l1/h1");
});
