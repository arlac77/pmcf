import test from "ava";
import {
  InitializationContext,
  Host,
  Network,
  wlan,
  networks_attribute,
  hosts_attribute,
  assign
} from "pmcf";

test("WLAN basics", t => {
  const ic = new InitializationContext();
  const n1 = new Network();
  ic.read(n1, {
    name: "W1000000",
    subnets: ["10.0.0.2/16"]
  });

  assign(networks_attribute, ic.root, n1);
  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    networkInterfaces: {
      wlan0: {
        network: n1,
        ipAddresses: ["10.0.0.2"]
      }
    }
  });
  assign(hosts_attribute, n1, h1);

  const wlan0 = h1.networkInterfaces.get("wlan0");

  t.true(wlan0 instanceof wlan);
  t.is(wlan0.name, "wlan0");
  t.is(wlan0.kind, "wlan");
  t.is(wlan0.secretName, "W1000000.password");

  n1.secretName = "a.password";
  t.is(wlan0.secretName, "a.password");

  wlan0.secretName = "b.password";
  t.is(wlan0.secretName, "b.password");

  //t.deepEqual([...wlan0.subnets.keys()], ["10.0/16"]);
});
