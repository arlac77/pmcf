import test from "ava";
import {
  InitializationContext,
  Network,
  Host,
  Owner,
  assign,
  hosts_attribute,
  networks_attribute,
  owners_attribute
} from "pmcf";

function setup() {
  const ic = new InitializationContext("/somewhere");
  const root = ic.root;

  const ht1 = new Host();
  ic.read(ht1, { name: "ht1", properties: { p1: "ht1" } });
  assign(hosts_attribute, root, ht1);

  const ht2 = new Host();
  ic.read(ht2, { name: "ht2", extends: "/ht1" });
  assign(hosts_attribute, root, ht2);

  const n1 = new Network();
  ic.read(n1, {
    name: "n1",
    subnets: "10.0/16"
  });
  assign(networks_attribute, root, n1);

  const l1 = new Owner();
  ic.read(l1, {
    name: "l1",
    properties: { p1: "v1", n1: 7 }
  });
  assign(owners_attribute, root, l1);

  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    extends: "/ht2",
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
  assign(hosts_attribute, l1, h1);

  return { ic, root, ht1, ht2, n1, l1, h1 };
}

test("Root basics", async t => {
  const ic = new InitializationContext("/somewhere");
  const root = ic.root;

  t.is(root.directory, "/somewhere");
  t.is(root.typeName, "root");
  t.is(root.name, "");
  t.is(root.fullName, "");
  t.is(root.isTemplate, false);
  t.is(await ic.load("/"), root);
  t.is(await ic.load(""), root);
});

test("template from name '*'", t => {
  const ic = new InitializationContext("/somewhere");
  const l1 = new Owner();
  ic.read(l1, { name: "l*" });
  assign(owners_attribute, ic.root, l1);
  t.true(l1.isTemplate);
});

test("aggregate properties", t => {
  const { l1, h1 } = setup();

  t.is(h1.property("n1"), 7);
  t.is(h1.property("p1"), "v2");

  t.is(l1.property("n1"), 7);
  t.is(l1.property("p1"), "v1");
});

test("waking", t => {
  const { root, l1, h1, ht1, ht2 } = setup();

  t.deepEqual([...h1.walkDirections(["this", "owner"])], [h1, l1, root]);
  t.deepEqual([...h1.walkDirections(["owner"])], [l1, root]);
  t.deepEqual([...h1.walkDirections(["this"])], [h1]);
  t.deepEqual([...h1.walkDirections(["extends"])], [ht2, ht1]);
});

test("expression", t => {
  const { l1, h1 } = setup();

  t.is(l1.expression("name"), "l1");
  t.is(l1.expression("owner.name"), "");
  t.is(h1.expression("networkInterfaces.eth0.name"), "eth0");
  t.is(h1.expression("networkInterfaces.eth0.metric"), 1);
  t.is(h1.expression("networkInterfaces.eth0.network.name"), "n1");

  t.is(
    h1.expression(
      "networkInterfaces.eth0.ipAddresses['10.0.0.1'].network.name"
    ),
    "n1"
  );

  //console.log("XXX", h1.network);

  t.is([...h1.expression("subnets[].name")][0], "10.0/16"); // TODO why more than 0ne

  //t.is(h1.expression("networkInterfaces[name='eth0']"), "eth0");
});

test("expand", t => {
  const ic = new InitializationContext("/somewhere");
  const l1 = new Owner();
  ic.read(l1, {
    name: "l1",
    properties: { p1: "v1", n1: 7, deep: { d2: 8 } }
  });
  assign(owners_attribute, ic.root, l1);

  const h1 = new Host();
  ic.read(h1, { name: "h1" });
  assign(hosts_attribute, l1, h1);

  t.is(l1.expand("${directory}"), "/somewhere/l1");
  t.is(l1.expand("${owner.directory}"), "/somewhere");
  t.is(l1.expand("${fullName}"), "/l1");
  t.is(l1.expand("${p1}"), "v1");
  t.is(h1.expand("${fullName}"), "/l1/h1");
  t.is(h1.expand("${owner.fullName}"), "/l1");
  t.is(h1.expand("${n1 + 2}"), 9);
  t.is(h1.expand("${deep.d2 + 2}"), 10);
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

test("tags", t => {
  const ic = new InitializationContext("/somewhere");

  const l1 = new Owner();
  ic.read(l1, { name: "l1", tags: "t1" });
  assign(owners_attribute, ic.root, l1);

  l1.tags = "t2";

  t.deepEqual(l1.tags, new Set(["t1", "t2"]));
});

test("extract", t => {
  const ic = new InitializationContext("/somewhere");
  const l1 = new Owner();
  ic.read(l1, { name: "l1", tags: "tag1" });
  assign(owners_attribute, ic.root, l1);

  t.deepEqual(l1.toJSON(), {
    name: "l1",
    owner: { name: "", type: "root" },
    administratorEmail: "admin@undefined",
    directory: "/somewhere/l1",
    tags: ["tag1"]
  });
});

test("directory & name & owner", t => {
  const ic = new InitializationContext("/somewhere");
  const l1 = new Owner();
  ic.read(l1, { name: "l1" });
  assign(owners_attribute, ic.root, l1);

  t.is(l1.name, "l1");
  t.is(l1.fullName, "/l1");
  t.is(l1.directory, "/somewhere/l1");
  t.is(l1.root, ic.root);
  t.is(l1.owner, ic.root);
  t.is(ic.root.named("l1"), l1);
  t.is(ic.root.named("/l1"), l1);

  const h1 = new Host();
  ic.read(h1, { name: "h1" });
  assign(hosts_attribute, l1, h1);

  t.is(h1.directory, "/somewhere/l1/h1");
  t.is(h1.name, "h1");
  t.is(h1.fullName, "/l1/h1");
  t.is(h1.root, ic.root);
  t.is(h1.owner, l1);
  t.is(ic.root.named("/l1"), l1);
  t.is(l1.named("h1"), h1);
  t.is(l1.named("/l1/h1"), h1);
});
