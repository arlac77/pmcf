import test from "ava";
import {
  InitializationContext,
  host,
  network,
  assign,
  cidrAddresses,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6,
  networks_attribute,
  hosts_attribute
} from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("host minimal", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/minimal", import.meta.url).pathname
  );
  await ic.loadAll();

  const host1 = ic.named("/L1/host1");
  t.is(host1.name, "host1");
  t.is(host1.fullName, "/L1/host1");
});

test("host load", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const host2 = ic.named("/L1/n1/host2");
  const host1 = ic.named("/L1/host1");

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

  const content = host1.content;
  t.deepEqual(content.packaging, new Set(["alpm"]));
});

test("host isMember / isCluster", t => {
  const h1 = new host();
  const h2 = new host();

  t.false(h1.isCluster);
  t.true(h1.isMember(h1));
  t.false(h1.isMember(h2));
});

test.only("host extends", t => {
  const ic = new InitializationContext();
  const h0 = new host();
  ic.read(h0, {
    name: "h0",
    os: "linux",
    distribution: "suse",
    networkInterfaces: {
      lo: {}
    },
    content: {
      packaging: "alpm"
    },
    services: {
      http: {}
    }
  });

  const h0_http = h0.named("http");
  t.is(h0_http.name, "http");
  t.is(h0_http.port, 80);
  t.is(h0_http.owner, h0);

  assign(hosts_attribute, ic.root, h0);

  const h1 = new host();
  ic.read(h1, {
    extends: [h0],
    name: "h1",
    aliases: "h1a",
    deployment: "production",
    chassis: "phone",
    vendor: "vendor h1",
    architecture: "aarch64",
    serial: "123",
    networkInterfaces: {
      eth0: {
        kind: "ethernet"
      }
    },
    content: {
      packaging: "alpm",
      provides: "pkgh1",
      dependencies: "dpkgh1",
      replaces: "rpkgh1"
    },
    services: {
      http: {
        port: 1024
      }
    }
  });
  assign(hosts_attribute, ic.root, h1);

  const h1_http = h1.named("http");
  t.is(h1_http.name, "http");
  t.is(h1_http.port, 1024);
  t.is(h1_http.owner, h1);
  t.deepEqual(h1_http.extends, new Set([h0_http]));

  t.deepEqual([...h1.networkInterfaces.keys()].sort(), ["eth0", "lo"]);

  const lo = h1.networkInterfaces.get("lo");
  t.is(lo.owner, h1);

  //console.log(h1.children.map(n=>n.fullName));
  t.deepEqual(h1.children, [
    h1_http,
    h1.networkInterfaces.get("eth0"),
    h1.networkInterfaces.get("lo")
  ]);

  const h2 = new host();
  ic.read(h2, {
    name: "h2",
    extends: h1,
    aliases: "h2a",
    content: {
      provides: "pkgh2",
      dependencies: "dpkgh2",
      replaces: "rpkgh2"
    }
  });

  const h2_http = h2.named("http");
  t.is(h2_http.name, "http");
  t.is(h2_http.port, 1024);
  t.is(h2_http.owner, h2);
  t.deepEqual(h2_http.extends, new Set([h0_http]));

  assign(hosts_attribute, ic.root, h2);

  t.deepEqual(h2.children, [
    h2_http,
    h2._networkInterfaces.get("eth0"),
    h2._networkInterfaces.get("lo")
  ]);
  t.deepEqual(h2.named("lo"), h2.networkInterfaces.get("lo"));

  const h3 = new host();
  ic.read(h3, {
    name: "h3",
    id: "1234",
    extends: h2,
    aliases: "h3a",
    content: {
      packaging: "alpm",
      provides: "pkgh3",
      dependencies: "dpkgh3",
      replaces: "rpkgh3"
    }
  });

  const h3_http = h3.named("http");
  t.is(h3_http.name, "http");
  t.is(h3_http.port, 1024);
  t.is(h3_http.owner, h3);
  //t.deepEqual(h3_http.extends, new Set([h0_http]));

  assign(hosts_attribute, ic.root, h3);

  t.deepEqual(h3.children, [
    h3_http,
    h3._networkInterfaces.get("eth0"),
    h3._networkInterfaces.get("lo")
  ]);
  t.deepEqual(h3.named("lo"), h3.networkInterfaces.get("lo"));

  t.deepEqual([...h3.aliases].sort(), ["h3a", "h1a", "h2a"].sort());
  t.is(h3.os, "linux");
  t.is(h3.distribution, "suse");
  t.is(h3.deployment, "production");
  t.is(h3.chassis, "phone");
  t.is(h3.vendor, "vendor h1");
  t.is(h3.architecture, "aarch64");
  t.is(h3.serial, "123");
  t.is(h3.id, "1234");
  t.is(h1.networkInterfaces.get("eth0").kind, "ethernet");

  const c = h3.content;

  t.is(c.owner, h3);
  t.is(c.typeName, "content");
  t.deepEqual(c.packaging, new Set(["alpm"]));

  t.deepEqual([...c.provides].sort(), ["pkgh1", "pkgh2", "pkgh3"].sort());
  t.deepEqual(
    [...c.dependencies].sort(),
    ["dpkgh1", "dpkgh2", "dpkgh3"].sort()
  );
  t.deepEqual([...c.replaces].sort(), ["rpkgh1", "rpkgh2", "rpkgh3"].sort());
});

test("host domains & aliases", t => {
  const ic = new InitializationContext();
  const n1 = new network();
  ic.read(n1, {
    name: "n1",
    domain: "example.com"
  });
  assign(networks_attribute, ic.root, n1);

  const h1 = new host();
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

test("host addresses", t => {
  const ic = new InitializationContext();
  const owner = ic.root;
  const n1 = new network();
  ic.read(n1, {
    name: "n1",
    properties: { ipv4_prefix: "10.0" }
  });
  assign(networks_attribute, owner, n1);
  t.deepEqual(n1.properties, { ipv4_prefix: "10.0" });
  t.deepEqual(owner.children, [n1]);
  t.deepEqual([...owner.networks.keys()], ["n1"]);

  const h1 = new host();
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
    enabled: true,
    mtu: 1500,
    kind: "ethernet",
    scope: "global",
    linkLocalAddressing: false,
    owner: {
      name: "h1",
      type: "host"
    },
    hostName: "h1",
    network: {
      name: "n1",
      type: "network"
    },
    cidrAddresses: [
      "10.0.0.2/16",
      "fe80::1e57:3eff:fe22:9a8f/64",
      "169.254.1.2/16"
    ],
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
  t.deepEqual(h1.cidrAddresses, [
    "127.0.0.1/8",
    "::1/128",
    "10.0.0.2/16",
    "fe80::1e57:3eff:fe22:9a8f/64",
    "169.254.1.2/16"
  ]);
});

test("host addresses with network", t => {
  const ic = new InitializationContext();
  const owner = ic.root;

  const n1 = new network();
  ic.read(n1, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  assign(networks_attribute, owner, n1);

  const h1 = new host();
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

test("clone networkInterface", t => {
  const ic = new InitializationContext();

  const n1 = new network();
  ic.read(n1, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  assign(networks_attribute, ic.root, n1);

  const h1 = new host();
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

  const h2 = new host();
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
