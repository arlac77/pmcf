import test from "ava";
import { InitializationContext, Host, Network, wlan } from "pmcf";

test("WLAN basics", t => {
  const ic = new InitializationContext();
  const n1 = new Network();
  ic.read(n1,{
    name: "W1000000",
    subnets: ["10.0.0.2/16"]
  });

  const h2 = new Host();
  ic.read(h2,{
    name: "h2",
    networkInterfaces: {
      wlan0: {
        network: n1,
        ipAddresses: ["10.0.0.2"]
      }
    }
  });
  const wlan0 = h2.networkInterfaces.get("wlan0");

  t.true(wlan0 instanceof wlan);
  t.is(wlan0.name, "wlan0");
  t.is(wlan0.kind, "wlan");
  t.is(wlan0.secretName, "W1000000.password");

  n1.secretName = "a.password";
  t.is(wlan0.secretName, "a.password");

  wlan0.secretName = "b.password";
  t.is(wlan0.secretName, "b.password");
});
