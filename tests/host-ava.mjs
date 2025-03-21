import test from "ava";
import { Root, Host, Network } from "pmcf";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Host minimal", async t => {
  const root = new Root(new URL("fixtures/minimal", import.meta.url).pathname);
  await root.loadAll();

  const host1 = root.named("/L1/host1");
  t.is(host1.fullName, "/L1/host1");
  t.is(host1.name, "host1");
});

test("Host basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const host1 = await root.named("/L1/host1");
  t.deepEqual(host1.packaging, new Set(["arch"]));

  const eth0 = host1.typeNamed("network_interface", "eth0");
  t.is(eth0.network, root.named("/L1/n1"));

  await assertObject(t, host1, root1(root, "/L1/host1"));
});

test("Host all", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObjects(
    t,
    root.hosts(),
    root1(root, ["/L1/n1/host2", "/L1/host1"])
  );
});

test("Host extends aliases", t => {
  const owner = new Root("/");
  const hb = new Host(owner, { aliases: "a1" });
  const h1 = new Host(owner, {
    name: "h1",
    extends: hb,
    aliases: "a2"
  });

  t.deepEqual(h1.aliases, new Set(["a2", "a1"]));
});

test("Host domains & aliases", t => {
  const owner = new Root("/");
  const n1 = new Network(owner, { name: "n1", domain: "example.com" });
  owner.addObject(n1);

  const h1 = new Host(n1, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        ipAddress: "1.2.3.4",
        hostName: "name2"
      }
    }
  });
  n1.addObject(h1);

  t.is(h1.domain, "example.com");
  t.deepEqual([...h1.domains], ["example.com"]);
  t.deepEqual([...h1.localDomains], ["example.com"]);
  t.deepEqual(
    [...h1.domainNames].sort(),
    ["h1.example.com", "name2.example.com"].sort()
  );
  t.deepEqual(h1.foreignDomainNames, []);

  t.is(h1.domainName, "h1.example.com");

  h1.aliases = "o1.somewhere.net";

  t.deepEqual([...h1.domains].sort(), ["example.com", "somewhere.net"].sort());
  t.deepEqual([...h1.localDomains], ["example.com"]);
  t.deepEqual(
    [...h1.domainNames].sort(),
    ["h1.example.com", "o1.somewhere.net", "name2.example.com"].sort()
  );
  t.deepEqual(h1.foreignDomainNames, ["o1.somewhere.net"]);

  t.deepEqual(
    [...h1.domainNamesIn("example.com")].sort(),
    ["h1.example.com", "name2.example.com"].sort()
  );
  t.deepEqual([...h1.domainNamesIn("somewhere.net")], ["o1.somewhere.net"]);
  t.deepEqual([...h1.domainNamesIn("other.net")], []);

  h1.aliases = "h2";
  t.deepEqual([...h1.domains].sort(), ["example.com", "somewhere.net"].sort());
  t.deepEqual([...h1.localDomains], ["example.com"]);
  t.deepEqual(
    [...h1.domainNames].sort(),
    [
      "h1.example.com",
      "h2.example.com",
      "o1.somewhere.net",
      "name2.example.com"
    ].sort()
  );

  t.deepEqual(
    [...n1.domainNames].sort(),
    [
      "h1.example.com",
      "h2.example.com",
      "o1.somewhere.net",
      "name2.example.com"
    ].sort()
  );
});

test("Host addresses", t => {
  const owner = new Root("/");
  const n1 = new Network(owner, { name: "n1" });
  owner.addObject(n1);

  const h1 = new Host(n1, {
    name: "h1",
    networkInterfaces: {
      lo: {
        kind: "loopback",
        scope: "local",
        ipAddresses: ["127.0.0.1", "::1"]
      },
      eth0: {
        kind: "ethernet",
        scope: "global",
        ipAddresses: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
      }
    }
  });
  n1.addObject(h1);

  const lo = h1.typeNamed("network_interface", "lo");

  t.is(lo.name, "lo");

  const eth0 = h1.typeNamed("network_interface", "eth0");

  t.is(h1.named("eth0"), eth0);
  t.is(h1.typeNamed("network_interface", "eth0"), eth0);
  t.is(n1.typeNamed("network_interface", "h1/eth0"), eth0);
  t.is(owner.named("/n1/h1/eth0"), eth0);
  t.is(n1.named("h1/eth0"), eth0);
  t.is(eth0.name, "eth0");
  t.is(eth0.network, n1);
  t.is(h1.network, n1);
  t.is(n1.network, n1);

  t.deepEqual(eth0.toJSON(), {
    directory: "/n1/h1/eth0",
    name: "eth0",
    metric: 1004,
    kind: "ethernet",
    scope: "global",
    owner: {
      name: "h1",
      type: "host"
    },
    network: {
      name: "n1",
      type: "network"
    },
    cidrAddress: "10.0.0.2/16",
    cidrAddresses: [
      "10.0.0.2/16",
      "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64"
    ],
    rawAddress: "10.0.0.2",
    rawAddresses: ["10.0.0.2", "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f"]
  });

  const s1 = n1.subnetNamed("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnetNamed("fe80:0000:0000:0000/64");
  t.is(s2.name, "fe80:0000:0000:0000/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.rawAddresses, [
    "127.0.0.1",
    "0000:0000:0000:0000:0000:0000:0000:0001",
    "10.0.0.2",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f"
  ]);
  t.deepEqual(h1.cidrAddresses, [
    "127.0.0.1/8",
    "0000:0000:0000:0000:0000:0000:0000:0001/128",
    "10.0.0.2/16",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64"
  ]);
});

test("Host addresses with network", t => {
  const owner = new Root("/");

  const n1 = new Network(owner, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  owner.addObject(n1);

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  owner.addObject(h1);

  const s1 = n1.subnetNamed("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnetNamed("fe80:0000:0000:0000/64");
  t.is(s2.name, "fe80:0000:0000:0000/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.rawAddresses, [
    "10.0.0.2",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f"
  ]);
  t.deepEqual(h1.cidrAddresses, [
    "10.0.0.2/16",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64"
  ]);
});

test.skip("clone NetworkInterface", t => {
  const owner = new Root("/");

  const n1 = new Network(owner, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  owner.addObject(n1);

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  owner.addObject(h1);

  const h2 = new Host(owner, { name: "h2" });

  const ni = h1.typeNamed("network_interface", "eth0").forOwner(h2);

  t.is(ni.owner, h2);
  t.is(ni.name, "eth0");
});
