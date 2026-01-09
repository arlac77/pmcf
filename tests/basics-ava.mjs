import test from "ava";
import { extractFrom, Root, Network, Host, Location, Owner } from "pmcf";

function setup() {
  const root = new Root("/somewhere");

  const n1 = new Network(root);
  n1.read({
    name: "n1",
    subnets: "10.0/16"
  });
  root.addObject(n1);

  const l1 = new Location(root);
  l1.read({
    name: "l1",
    properties: { p1: "v1", n1: 7 }
  });
  root.addObject(l1);
  const h1 = new Host(l1);
  h1.read({
    name: "h1",
    properties: { p1: "v2" },
    networkInterfaces: {
      eth0: {
        network: "/n1",
        metric: 1,
        ipAddresses: "10.0.0.1"
      },
      eth1: {
        network: "/n1",
        metric: 2,
        ipAddresses: "10.1.0.1"
      }
    }
  });
  l1.addObject(h1);

  return { root, n1, l1, h1 };
}

test("Root basics", async t => {
  const root = new Root("/somewhere");
  t.is(root.directory, "/somewhere");
  t.is(root.typeName, "root");
  t.is(root.name, "");
  t.is(root.fullName, "");
  t.is(root.isTemplate, false);
  t.is(await root.load("/"), root);
  t.is(await root.load(""), root);
});

test("template from name '*'", t => {
  const root = new Root("/somewhere");
  const l1 = new Location(root, { name: "l*" });
  t.true(l1.isTemplate);
});

test("owners", t => {
  const { root, l1, h1 } = setup();

  t.deepEqual([...h1.owners()], [l1, root]);

  t.is(h1.property("n1"), 7);
  t.is(h1.property("p1"), "v2");

  t.is(l1.property("n1"), 7);
  t.is(l1.property("p1"), "v1");
});

test("expression", t => {
  const { root, l1, h1 } = setup();

  t.is(l1.expression("name"), "l1");
  t.is(l1.expression("owner.name"), "");
  t.is(l1.expression("location.name"), "l1");
  t.is(h1.expression("networkInterfaces.eth0.name"), "eth0");
  t.is(h1.expression("networkInterfaces.eth0.metric"), 1);
  //t.is(h1.expression("networkInterfaces.eth0.ipAddresses"), ["10.0.0.1"]);
  //t.is(h1.expression("networkInterfaces[name='eth1'].name"), "eth1");
});

test("expand", t => {
  const root = new Root("/somewhere");
  const l1 = new Location(root);
  l1.read({
    name: "l1",
    properties: { p1: "v1", n1: 7 }
  });
  root.addObject(l1);
  const h1 = new Host(l1);
  h1.read({ name: "h1" });
  l1.addObject(h1);

  t.is(l1.expand("${directory}"), "/somewhere/l1");
  t.is(l1.expand("${owner.directory}"), "/somewhere");
  t.is(l1.expand("${fullName}"), "/l1");
  t.is(l1.expand("${p1}"), "v1");
  t.is(h1.expand("${fullName}"), "/l1/h1");
  t.is(h1.expand("${owner.fullName}"), "/l1");
  t.is(h1.expand("${p1}"), "v1");
  t.is(h1.expand("${n1 + 2}"), 9);
  t.deepEqual(
    h1.expand(
      new Map([
        ["k", "v"],
        ["${p1}", "${fullName}"]
      ])
    ),
    new Map([
      ["k", "v"],
      ["v1", "/l1/h1"]
    ])
  );

  //t.deepEqual(h1.expand("${owner.domains}"), new Set()); // TODO empty array ?
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

  const l1 = new Location(root);
  l1.read({ name: "l1" });
  root.addObject(l1);
  t.is(l1.name, "l1");
  t.is(l1.fullName, "/l1");
  t.is(l1.directory, "/somewhere/l1");
  t.is(l1.root, root);
  t.is(l1.owner, root);
  t.is(root.named("/l1"), l1);
  t.is(root.locationNamed("/l1"), l1);

  const h1 = new Host(l1);
  h1.read({ name: "h1" });
  l1.addObject(h1);
  t.is(h1.directory, "/somewhere/l1/h1");
  t.is(h1.name, "h1");
  t.is(h1.fullName, "/l1/h1");
  t.is(h1.root, root);
  t.is(h1.owner, l1);
  t.is(root.named("/l1"), l1);
  t.is(l1.named("h1"), h1);
  t.is(l1.named("/l1/h1"), h1);
  t.is(l1.hostNamed("/l1/h1"), h1);

  const h2 = new Host(l1);
  h2.read({ name: "l2/h2" });
  l1.addObject(h2);
  t.is(h2.directory, "/somewhere/l1/l2/h2");
  t.is(h2.name, "l2/h2");
  t.is(h2.fullName, "/l1/l2/h2");
  t.is(h2.root, root);
  t.is(h2.owner, l1);
  t.is(l1.named("l2/h2"), h2);
  t.is(l1.named("/l1/l2/h2"), h2);
  t.is(l1.hostNamed("/l1/l2/h2"), h2);
});
