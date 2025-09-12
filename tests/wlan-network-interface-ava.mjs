import test from "ava";
import { Root, Host, Network } from "pmcf";

test("WLAN basics", t => {
  const owner = new Root("/");

  const n1 = new Network(owner);
  n1.read({
    name: "W1000000",
    subnets: ["10.0.0.2/16"]
  });
  owner.addObject(n1);

  const h2 = new Host(owner);
  h2.read({
    name: "h2",
    networkInterfaces: {
      wlan0: {
        network: n1,
        ipAddresses: ["10.0.0.2"]
      }
    }
  });
  const wlan0 = h2.networkInterfaces.get("wlan0");

  t.is(wlan0.name, "wlan0");
  t.is(wlan0.kind, "wlan");
  t.is(wlan0.secretName, "W1000000.password");

  n1.secretName = "a.password";
  t.is(wlan0.secretName, "a.password");

  wlan0.secretName = "b.password";
  t.is(wlan0.secretName, "b.password");
});
