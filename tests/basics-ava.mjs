import test from "ava";
import {
  Root,
  Host,
  Location,
  Network,
  Service,
  Subnet,
  Base
} from "pmcf";

test("types", t => {
  t.is(Root.types.location, Location);
  t.is(Root.types.network, Network);
  t.is(Root.types.subnet, Subnet);
  t.is(Root.types.service, Service);
  t.is(Root.types.host, Host);
});

test("Root basics", async t => {
  const root = new Root("/somwhere");
  t.is(root.typeName, "root");
  t.is(root.directory, "/somwhere");
  t.is(root.name, "");
  t.is(root.fullName, "");
  t.is(await root.load(""),root);
});

test("normalizeName", t => {
  t.is(Base.normalizeName(""), "");
  t.is(Base.normalizeName(), undefined);
  t.is(Base.normalizeName("abc"), "abc");
  t.is(Base.normalizeName("abc/def"), "abc/def");
  t.is(Base.normalizeName("abc/def.json"), "abc");
});

test("directory & name", t => {
  const root = new Root("/somwhere");

  const l1 = new Location(root, { name: "l1" });
  t.is(l1.directory, "/somwhere/l1");
  t.is(l1.name, "l1");
  t.is(l1.fullName, "l1");
  t.is(l1.root, root);

  const h1 = new Location(l1, { name: "h1" });
  t.is(h1.directory, "/somwhere/l1/h1");
  t.is(h1.name, "h1");
  t.is(h1.fullName, "l1/h1");
  t.is(h1.root, root);

  const h2 = new Location(l1, { name: "l2/h2" });
  t.is(h2.directory, "/somwhere/l1/l2/h2");
  t.is(h2.name, "l2/h2");
  t.is(h2.fullName, "l1/l2/h2");
  t.is(h2.root, root);
});
