import test from "ava";
import { extractFrom, Root, Host, Location, Owner, Base } from "pmcf";

test("Root basics", async t => {
  const root = new Root("/somewhere");
  t.is(root.typeName, "root");
  t.is(root.directory, "/somewhere");
  t.is(root.name, "");
  t.is(root.fullName, "");
  t.is(await root.load(""), root);
});

test("normalizeName", t => {
  t.is(Base.normalizeName(""), "");
  t.is(Base.normalizeName(), undefined);
  t.is(Base.normalizeName("abc"), "abc");
  t.is(Base.normalizeName("abc/def"), "abc/def");
  t.is(Base.normalizeName("abc/def.json"), "abc");
});

test("expand", t => {
  const root = new Root("/somewhere");
  const l1 = new Location(root, { name: "l1" });
  const h1 = new Location(l1, { name: "h1" });

  t.is(l1.expand("${directory}"), "/somewhere/l1");
  t.is(l1.expand("${owner.directory}"), "/somewhere");
  t.is(l1.expand("${fullName}"), "l1");
  t.is(h1.expand("${fullName}"), "l1/h1");
  t.is(h1.expand("${owner.fullName}"), "l1");
  t.is(h1.expand("${owner.domains}"), ""); // TODO empty array ?
});

test("extract", t => {
  const root = new Root("/somewhere");
  const l1 = new Owner(root, { name: "l1" });

  t.deepEqual(extractFrom(l1, Owner.typeDefinition), {
    name: "l1",
    owner: { type: "root" },
    administratorEmail: "admin@undefined",
    directory: "/somewhere/l1"
  });
});

test("directory & name & owner", t => {
  const root = new Root("/somewhere");

  const l1 = new Location(root, { name: "l1" });
  t.is(l1.directory, "/somewhere/l1");
  t.is(l1.name, "l1");
  t.is(l1.fullName, "l1");
  t.is(l1.root, root);
  t.is(l1.owner, root);

  t.is(root.locationNamed("l1"), l1);

  const h1 = new Host(l1, { name: "h1" });
  t.is(h1.directory, "/somewhere/l1/h1");
  t.is(h1.name, "h1");
  t.is(h1.fullName, "l1/h1");
  t.is(h1.root, root);
  t.is(h1.owner, l1);
  t.is(l1.hostNamed("l1/h1"), h1);

  const h2 = new Host(l1, { name: "l2/h2" });
  t.is(h2.directory, "/somewhere/l1/l2/h2");
  t.is(h2.name, "l2/h2");
  t.is(h2.fullName, "l1/l2/h2");
  t.is(h2.root, root);
  t.is(h2.owner, l1);
  t.is(l1.hostNamed("l1/l2/h2"), h2);
});
