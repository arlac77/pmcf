import test from "ava";
import { Root, Host, Network } from "pmcf";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Host minimal", async t => {
  const root = new Root(new URL("fixtures/minimal", import.meta.url).pathname);
  await root.loadAll();

  const host1 = root.named("L1/host1");

  t.is(host1.name, "host1");
});

test("Host basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  await assertObject(t, await root.named("L1/host1"), root1(root, "L1/host1"));
});

test("Host all", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObjects(
    t,
    root.hosts(),
    root1(root, ["L1/n1/host2", "L1/host1"])
  );
});

test("Host addresses", t => {
  const owner = new Root();

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        ipAddresses: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
      }
    }
  });

  t.is(h1.networkInterfacesNamed("eth0").name, "eth0");

  const s1 = owner.subnetNamed("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = owner.subnetNamed("fe80:0000:0000:0000/64");
  t.is(s2.name, "fe80:0000:0000:0000/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.ipAddresses, [
    "10.0.0.2",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f"
  ]);
  t.deepEqual(h1.ipAddressesWithPrefixLength, [
    "10.0.0.2/16",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64"
  ]);
});

test("Host addresses with network", t => {
  const owner = new Root();

  const n1 = new Network(owner, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });

  const s1 = owner.subnetNamed("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = owner.subnetNamed("fe80:0000:0000:0000/64");
  t.is(s2.name, "fe80:0000:0000:0000/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.ipAddresses, [
    "10.0.0.2",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f"
  ]);
  t.deepEqual(h1.ipAddressesWithPrefixLength, [
    "10.0.0.2/16",
    "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64"
  ]);
});

test.skip("clone NetworkInterface", t => {
  const owner = new Root();

  const n1 = new Network(owner, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });

  const h2 = new Host(owner, { name: "h2" });

  const ni = h1.networkInterfaceNamed("eth0").forOwner(h2);

  t.is(n1.owner, h2);
  t.is(n1.name, "eth0");
});
