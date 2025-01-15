import test from "ava";
import {
  World,
  Host,
  Location,
  Network,
  Service,
  Subnet
} from "../src/model.mjs";

test("types", async t => {
  t.is(World.types.location, Location);
  t.is(World.types.network, Network);
  t.is(World.types.subnet, Subnet);
  t.is(World.types.service, Service);
  t.is(World.types.host, Host);
});
