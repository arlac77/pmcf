import test from "ava";
import { filter } from "pacc";
import { Root, Host, Network } from "pmcf";

test("NetworkAddress filter", t => {
  const owner = new Root("/");

  const n1 = new Network(owner, {
    name: "n1",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"]
  });
  owner.addObject(n1);

  const [s1, s2] = [...n1.subnets()];

  const h2 = new Host(owner, {
    name: "h2",
    networkInterfaces: {
      eth0: {
        network: n1,
        ipAddresses: ["10.0.0.2", "fe80::1e57:3eff:fe22:9a8f"]
      }
    }
  });

  const domainNames = new Set(["h2."]);
  const eth0 = h2.networkInterfaces.get("eth0");

  const a1 = {
    networkInterface: eth0,
    domainNames,
    subnet: s1,
    address: "10.0.0.2"
  };
  const a2 = {
    networkInterface: eth0,
    domainNames,
    subnet: s2,
    address: "fe80::1e57:3eff:fe22:9a8f"
  };

  t.deepEqual([...h2.networkAddresses()], [a1, a2]);

  t.deepEqual(
    [...h2.networkAddresses(n => n.networkInterface.network.name !== "n1")],
    []
  );
});
