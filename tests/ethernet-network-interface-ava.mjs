import test from "ava";
import {
  InitializationContext,
  Host,
  Network,
  ethernet,
  networks_attribute,
  hosts_attribute,
  assign
} from "pmcf";

test("ethernet common names", t => {
  t.false(ethernet.isCommonName("wlan0"));
  t.true(ethernet.isCommonName("eth0"));
  t.true(ethernet.isCommonName("end1"));
  t.true(ethernet.isCommonName("en1"));
});

test("ethernet basics", t => {
  const ic = new InitializationContext();
  const n1 = new Network();
  ic.read(n1, {
    name: "W1000000",
    subnets: ["10.0.0.2/16"]
  });

  t.deepEqual([...n1.subnets.keys()], ["fe80::/64", "10.0/16"]);

  assign(networks_attribute, ic.root, n1);
  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2"]
      }
    }
  });
  assign(hosts_attribute, n1, h1);

  const eth0 = h1.networkInterfaces.get("eth0");

  t.is(eth0.address, "10.0.0.2");

  t.deepEqual([...eth0.subnets.keys()], ["10.0/16"]);

  t.true(eth0 instanceof ethernet);
  t.is(eth0.name, "eth0");
  t.is(eth0.kind, "ethernet");
});
