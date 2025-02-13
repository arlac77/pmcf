import test from "ava";
import {
  Root,
  Host,
  Location,
  Network,
  Service,
  Subnet,
  Owner,
  typesByName
} from "pmcf";

test("types", t => {
  t.is(typesByName.root, Root);
  t.is(typesByName.location, Location);
  t.is(typesByName.network, Network);
  t.is(typesByName.subnet, Subnet);
  t.is(typesByName.service, Service);
  t.is(typesByName.host, Host);
  t.is(typesByName.owner, Owner);
});
