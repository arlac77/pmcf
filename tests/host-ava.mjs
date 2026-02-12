import test from "ava";
import {
  Root,
  Host,
  Network,
  Subnet,
  cidrAddresses,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6
} from "pmcf";
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

  /*
  const host2 = await root.named("/L1/n1/host2");
  const wlan0 = host2.typeNamed("network_interface", "wlan0");
  console.log(wlan0.constructor.name);
  */

  await assertObjects(
    t,
    root.hosts,
    root1(root, ["/L1/n1/host2", "/L1/host1"])
  );
});

test("Host extends", t => {
  const owner = new Root("/");

  const linux = new Host(owner);
  linux.read({
    name: "linux",
    os: "linux",
    distribution: "suse",
    networkInterfaces: {
      lo: {}
    }
  });

  const e1 = new Host(owner);
  e1.read({
    extends: [linux],
    name: "e1",
    aliases: "e1a",
    deployment: "production",
    chassis: "phone",
    vendor: "vendor e1",
    architecture: "aarch64",
    serial: "123",
    provides: "pkge1",
    depends: "dpkge1",
    replaces: "rpkge1",
    networkInterfaces: {
      eth0: {
        kind: "ethernet"
      }
    }
  });

  e1.execFinalize();

  t.deepEqual([...e1.networkInterfaces.keys()].sort(), ["eth0", "lo"]);

  const e2 = new Host(owner);
  e2.read({
    name: "e2",
    extends: e1,
    aliases: "e2a",
    provides: "pkge2",
    depends: "dpkge2",
    replaces: "rpkge2"
  });

  const h1 = new Host(owner);
  h1.read({
    name: "h1",
    extends: e2,
    aliases: "h1a",
    provides: "pkgh1",
    depends: "dpkgh1",
    replaces: "rpkgh1"
  });

  t.deepEqual([...h1.aliases].sort(), ["h1a", "e1a", "e2a"].sort());
  t.is(h1.os, "linux");
  t.is(h1.distribution, "suse");
  t.is(h1.deployment, "production");
  t.is(h1.chassis, "phone");
  t.is(h1.vendor, "vendor e1");
  t.is(h1.architecture, "aarch64");
  t.is(h1.serial, "123");
  t.deepEqual([...h1.provides].sort(), ["pkge1", "pkge2", "pkgh1"].sort());
  t.deepEqual([...h1.depends].sort(), ["dpkge1", "dpkge2", "dpkgh1"].sort());
  t.deepEqual([...h1.replaces].sort(), ["rpkge1", "rpkge2", "rpkgh1"].sort());

  h1.finalize();

  t.is(e1.networkInterfaces.get("eth0").kind, "ethernet");
});

test("Host domains & aliases", t => {
  const owner = new Root("/");
  const n1 = new Network(owner);
  n1.read({
    name: "n1",
    domain: "example.com"
  });
  owner.addObject(n1);

  const h1 = new Host(n1);
  h1.read({
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
  const n1 = new Network(owner);
  n1.read({
    name: "n1",
    properties: { ipv4_prefix: "10.0" }
  });
  owner.addObject(n1);

  const h1 = new Host(n1);
  h1.read({
    name: "h1",
    networkInterfaces: {
      lo: {},
      eth0: {
        scope: "global",
        ipAddresses: ["${ipv4_prefix}.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
      }
    }
  });
  n1.addObject(h1);

  const lo = h1.typeNamed("network_interface", "lo");

  t.is(lo.name, "lo");
  t.is(lo.typeName, "network_interface");
  t.deepEqual(
    new Set(lo.subnets()),
    new Set([SUBNET_LOCALHOST_IPV4, SUBNET_LOCALHOST_IPV6])
  );

  const eth0 = h1.typeNamed("network_interface", "eth0");
  t.is(eth0.typeName, "network_interface");

  t.deepEqual(
    h1.subnets,
    new Set([SUBNET_LOCALHOST_IPV4, SUBNET_LOCALHOST_IPV6, ...eth0.subnets()])
  );

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
    // metric: 1004,
    mtu: 1500,
    kind: "ethernet",
    scope: "global",
    owner: {
      name: "h1",
      type: "host"
    },
    hostName: "h1",
    network: {
      name: "n1",
      type: "network"
    },
    ipAddresses: [
      ["10.0.0.2", new Subnet(n1, "10.0.0.2/16")],
      [
        "fe80::1e57:3eff:fe22:9a8f",
        new Subnet(n1, "fe80::1e57:3eff:fe22:9a8f/64")
      ]
    ],
    address: "10.0.0.2",
    addresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
  });

  const s1 = n1.subnetNamed("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnetNamed("fe80::/64");
  t.is(s2.name, "fe80::/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.addresses, [
    "127.0.0.1",
    "::1",
    "10.0.0.2",
    "fe80::1e57:3eff:fe22:9a8f"
  ]);
  t.deepEqual(cidrAddresses(h1.networkAddresses()), [
    "127.0.0.1/8",
    "::1/128",
    "10.0.0.2/16",
    "fe80::1e57:3eff:fe22:9a8f/64"
  ]);
});

test("Host addresses with network", t => {
  const owner = new Root("/");

  const n1 = new Network(owner);
  n1.read({
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  owner.addObject(n1);

  const h1 = new Host(owner);
  h1.read({
    name: "h1",
    networkInterfaces: {
      eth0: {
        kind: "ethernet",
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  owner.addObject(h1);

  const s1 = n1.subnetNamed("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnetNamed("fe80::/64");
  t.is(s2.name, "fe80::/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.addresses, ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]);
  t.deepEqual(cidrAddresses(h1.networkAddresses()), [
    "10.0.0.2/16",
    "fe80::1e57:3eff:fe22:9a8f/64"
  ]);
});

test("clone NetworkInterface", t => {
  const owner = new Root("/");

  const n1 = new Network(owner);
  n1.read({
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  owner.addObject(n1);

  const h1 = new Host(owner);
  h1.read({
    name: "h1",
    networkInterfaces: {
      eth0: {
        hwaddr: "00:01:02:03:04:05"
      }
    }
  });
  owner.addObject(h1);

  const h2 = new Host(owner);
  h2.read({
    name: "h2",
    extends: [h1],
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  h2.execFinalize();

  const ni = h2.typeNamed("network_interface", "eth0");

  t.is(ni.name, "eth0");
  t.is(ni.owner, h2);
  t.is(ni.network, n1);
  t.is(ni.hwaddr, "00:01:02:03:04:05");
  t.is(ni.kind, "ethernet");

  t.deepEqual(ni.addresses, ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]);
});
