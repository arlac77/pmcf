import test from "ava";
import { root as Root, Host, Network, NetworkAddress } from "pmcf";
import { InitializationContext } from "../src/initialization-context.mjs";

test("NetworkAddress filter", t => {
  const ic = new InitializationContext();
  const owner = new Root("/");

  const n1 = new Network(owner);
  ic.read(n1,{
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  owner.addObject(n1);

  const [s1, s2] = [...n1.subnets];

  const h2 = new Host(owner);
  ic.read(h2,{
    name: "h2",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });
  const eth0 = h2.networkInterfaces.get("eth0");

  const a1 = new NetworkAddress(eth0, "10.0.0.2", s1);
  const a2 = new NetworkAddress(eth0, "fe80::1e57:3eff:fe22:9a8f", s2);

  t.deepEqual([...h2.networkAddresses()], [a1, a2]);

  t.deepEqual([...h2.networkAddresses(n => n.family === "IPv4")], [a1]);
});
