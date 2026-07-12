import test from "ava";
import {
  InitializationContext,
  Host,
  Network,
  assign,
  cidrAddresses,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6,
  networks_attribute,
  hosts_attribute
} from "pmcf";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Host minimal", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/minimal", import.meta.url).pathname
  );
  await ic.loadAll();

  const host1 = ic.named("/L1/host1");
  t.is(host1.name, "host1");
  t.is(host1.fullName, "/L1/host1");
});

test("Host load", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const host2 = ic.named("/L1/n1/host2");
  const host1 = ic.named("/L1/host1");
  t.deepEqual(host1.packaging, new Set(["arch"]));

  const eth0 = host1.named("eth0");
  t.is(eth0.network, ic.named("/L1/n1"));

  //const templates = ic.root.named("/templates");
  //console.log([...templates.children].map(n => [n.name, n.typeName]));
  //console.log("HOST", services.hosts.get("timemachine").typeName);
  //console.log("SERVICE", templates.services.get("timemachine").typeName);

  /*t.is(
    services.hosts.get("timemachine").services.get("timemachine"),
    services.services.get("timemachine")
  );*/
  /*
  console.log([...ic.root.hosts.values()].map(h => h.fullName));
  console.log([...ic.root.networks.values()].map(h => h.fullName));
  console.log(ic.root.named("/L1/n1"));
  */

  await assertObject(t, host1, root1(ic.root, "/L1/host1"));
  await assertObject(t, host2, root1(ic.root, "/L1/n1/host2"));

  /*await assertObjects(
    t,
    ic.root.hosts,
    root1(ic.root, ["/L1/n1/host2", "/L1/host1"])
  );*/
});

test("Host extends", t => {
  const ic = new InitializationContext();

  const linux = new Host();
  ic.read(linux, {
    name: "linux",
    os: "linux",
    distribution: "suse",
    networkInterfaces: {
      lo: {}
    }
  });
  assign(hosts_attribute, ic.root, linux);

  const e1 = new Host();
  ic.read(e1, {
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
  assign(hosts_attribute, ic.root, e1);

  t.deepEqual([...e1.networkInterfaces.keys()].sort(), ["eth0", "lo"]);

  t.deepEqual(e1.children, [
    e1.networkInterfaces.get("eth0"),
    e1.networkInterfaces.get("lo")
  ]);

  const e2 = new Host();
  ic.read(e2, {
    name: "e2",
    extends: e1,
    aliases: "e2a",
    provides: "pkge2",
    depends: "dpkge2",
    replaces: "rpkge2"
  });
  assign(hosts_attribute, ic.root, e2);

  t.deepEqual(e2.children, [
    e2._networkInterfaces.get("eth0"),
    e2._networkInterfaces.get("lo")
  ]);
  t.deepEqual(e2.named("lo"), e2.networkInterfaces.get("lo"));

  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    "machine-id": "1234",
    extends: e2,
    aliases: "h1a",
    provides: "pkgh1",
    depends: "dpkgh1",
    replaces: "rpkgh1"
  });
  assign(hosts_attribute, ic.root, h1);

  t.deepEqual(h1.children, [
    h1._networkInterfaces.get("eth0"),
    h1._networkInterfaces.get("lo")
  ]);
  t.deepEqual(h1.named("lo"), h1.networkInterfaces.get("lo"));

  t.deepEqual([...h1.aliases].sort(), ["h1a", "e1a", "e2a"].sort());
  t.is(h1.os, "linux");
  t.is(h1.distribution, "suse");
  t.is(h1.deployment, "production");
  t.is(h1.chassis, "phone");
  t.is(h1.vendor, "vendor e1");
  t.is(h1.architecture, "aarch64");
  t.is(h1.serial, "123");
  t.is(h1.id, "1234");
  t.deepEqual([...h1.provides].sort(), ["pkge1", "pkge2", "pkgh1"].sort());
  t.deepEqual([...h1.depends].sort(), ["dpkge1", "dpkge2", "dpkgh1"].sort());
  t.deepEqual([...h1.replaces].sort(), ["rpkge1", "rpkge2", "rpkgh1"].sort());

  t.is(e1.networkInterfaces.get("eth0").kind, "ethernet");
});

test("Host domains & aliases", t => {
  const ic = new InitializationContext();
  const n1 = new Network();
  ic.read(n1, {
    name: "n1",
    domain: "example.com"
  });
  assign(networks_attribute, ic.root, n1);

  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        ipAddress: "1.2.3.4",
        hostName: "name2"
      }
    }
  });
  assign(hosts_attribute, n1, h1);

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
  const ic = new InitializationContext();
  const owner = ic.root;
  const n1 = new Network();
  ic.read(n1, {
    name: "n1",
    properties: { ipv4_prefix: "10.0" }
  });
  assign(networks_attribute, owner, n1);
  t.deepEqual(n1.properties, { ipv4_prefix: "10.0" });
  t.deepEqual(owner.children, [n1]);
  t.deepEqual([...owner.networks.keys()], ["n1"]);

  const h1 = new Host();
  h1.name = "h1";
  assign(hosts_attribute, n1, h1);
  t.is(n1.named("h1"), h1);

  ic.read(h1, {
    networkInterfaces: {
      lo: {},
      eth0: {
        network: n1,
        scope: "global",
        ipAddresses: [
          "${ipv4_prefix}.0.2/16",
          "fe80::1e57:3eff:fe22:9a8f/64",
          "169.254.1.2"
        ]
      }
    }
  });

  const lo = h1.named("lo");
  t.is(lo.name, "lo");
  t.is(lo.typeName, "network_interface");
  t.deepEqual(
    new Set(lo.subnets.values()),
    new Set([SUBNET_LOCALHOST_IPV4, SUBNET_LOCALHOST_IPV6])
  );

  const eth0 = h1.named("eth0");
  t.is(eth0.typeName, "network_interface");
  t.is(eth0.scope, "global");

  t.deepEqual(
    eth0.ipAddresses,
    new Map([
      ["10.0.0.2", n1.subnets.get("10.0/16")],
      ["fe80::1e57:3eff:fe22:9a8f", n1.subnets.get("fe80::/64")],
      ["169.254.1.2", n1.subnets.get("169.254/16")]
    ])
  );

  t.deepEqual(
    new Set(h1.subnets.values()),
    new Set([
      SUBNET_LOCALHOST_IPV4,
      SUBNET_LOCALHOST_IPV6,
      ...eth0.subnets.values()
    ])
  );

  t.is(h1.named("eth0"), eth0);
  t.is(owner.named("/n1"), n1);
  t.is(n1.named("h1"), h1);
  t.is(owner.named("/n1/h1"), h1);
  t.is(owner.named("/n1/h1/eth0"), eth0);
  t.is(n1.named("h1/eth0"), eth0);
  t.is(eth0.name, "eth0");
  t.is(eth0.network, n1);
  t.is(h1.network, n1);
  t.is(n1.network, n1);

  t.deepEqual(eth0.toJSON(), {
    directory: "/n1/h1/eth0",
    name: "eth0",
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
    /*ipAddresses: [
          "10.0.0.2", 
          n1.subnets.get("10.0/16"),
      "fe80::1e57:3eff:fe22:9a8f", 
      n1.subnets.get("fe80::/64")
    ],*/
    address: "10.0.0.2",
    addresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f", "169.254.1.2"]
  });

  /*
  console.log("NETWORK", n1.subnets);
  console.log("HOST", h1.subnets);
  console.log("INTERFACE", eth0.subnets);
  */
  const s1 = eth0.subnets.get("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnets.get("fe80::/64");
  t.is(s2.name, "fe80::/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.addresses, [
    "127.0.0.1",
    "::1",
    "10.0.0.2",
    "fe80::1e57:3eff:fe22:9a8f",
    "169.254.1.2"
  ]);
  t.deepEqual(cidrAddresses(h1.networkAddresses()), [
    "127.0.0.1/8",
    "::1/128",
    "10.0.0.2/16",
    "fe80::1e57:3eff:fe22:9a8f/64",
    "169.254.1.2/16"
  ]);
});

test("Host addresses with network", t => {
  const ic = new InitializationContext();
  const owner = ic.root;

  const n1 = new Network();
  ic.read(n1, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  assign(networks_attribute, owner, n1);

  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        kind: "ethernet",
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  assign(hosts_attribute, owner, n1);

  const s1 = n1.subnets.get("10.0/16");
  t.is(s1.name, "10.0/16");
  t.is(s1.prefixLength, 16);

  const s2 = n1.subnets.get("fe80::/64");
  t.is(s2.name, "fe80::/64");
  t.is(s2.prefixLength, 64);

  t.deepEqual(h1.addresses, ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]);
  t.deepEqual(cidrAddresses(h1.networkAddresses()), [
    "10.0.0.2/16",
    "fe80::1e57:3eff:fe22:9a8f/64"
  ]);
});

test("clone NetworkInterface", t => {
  const ic = new InitializationContext();

  const n1 = new Network();
  ic.read(n1, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  assign(networks_attribute, ic.root, n1);

  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        hwaddr: "00:01:02:03:04:05"
      }
    }
  });
  assign(hosts_attribute, ic.root, n1);

  const h1ni = h1.named("eth0");
  t.is(h1ni.hwaddr, "00:01:02:03:04:05");

  const h2 = new Host();
  ic.read(h2, {
    name: "h2",
    extends: [h1],
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  assign(hosts_attribute, ic.root, h2);

  const ni = h2.named("eth0");

  t.is(ni.name, "eth0");
  t.is(ni.owner, h2);
  t.is(ni.network, n1);
  t.is(ni.hwaddr, "00:01:02:03:04:05");
  t.is(ni.kind, "ethernet");

  t.deepEqual(ni.addresses, ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]);
});
