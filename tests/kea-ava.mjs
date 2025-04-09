import test from "ava";
import { Root, Host, DHCPService, Endpoint } from "pmcf";

test("kea basics", t => {
  const owner = new Root("/");

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      l0: { ipAddresses: "127.0.0.1", scope: "host" },
      eth0: { ipAddresses: "10.0.0.1/16" }
    }
  });
  owner.addObject(h1);

  const l0 = h1.networkInterfaces.get("l0");
  const eth0 = h1.networkInterfaces.get("eth0");

  const kea = new DHCPService(h1, {
    name: "kea",

    subsystems: {
      "kea-control-agent": {
        port: 8000
      },
      "kea-ddns": {
        port: 53001
      }
    }
  });

  h1.services = kea;

  t.deepEqual(kea.endpoints(), [
    new Endpoint(kea, l0, {
      type: "dhcp",
      port: 547,
      protocol: "udp",
      tls: false
    }),
    new Endpoint(kea, eth0, {
      type: "dhcp",
      port: 547,
      protocol: "udp",
      tls: false
    }),
    new Endpoint(kea, l0, {
      type: "kea-control-agent",
      port: 8000,
      protocol: "tcp",
      tls: false
    }),
    new Endpoint(kea, l0, {
      type: "kea-ddns",
      port: 53001,
      protocol: "tcp",
      tls: false
    })
  ]);
});
