import test from "ava";
import { Root, Host, DHCPService, Endpoint } from "pmcf";

test("kea basics", t => {
  const owner = new Root("/");

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      l0: { kind: "loopback" },
      eth0: { ipAddresses: "10.0.0.1/16" }
    }
  });
  owner.addObject(h1);

  const la = h1.networkAddresses(na => na.networkInterface.kind === "loopback");
  const ea = h1.networkAddresses(na => na.networkInterface.kind !== "loopback");

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
    ...la.map(
      a =>
        new Endpoint(kea, a, {
          type: "dhcp",
          port: 547,
          protocol: "udp",
          tls: false
        })
    ),
    ...ea.map(
      a =>
        new Endpoint(kea, a, {
          type: "dhcp",
          port: 547,
          protocol: "udp",
          tls: false
        })
    ),
    ...[...la]
      .map(a => [
        new Endpoint(kea, a, {
          type: "kea-control-agent",
          port: 8000,
          protocol: "tcp",
          tls: false
        }),
        new Endpoint(kea, a, {
          type: "kea-ddns",
          port: 53001,
          protocol: "tcp",
          tls: false
        })
      ])
      .flat()
  ]);
});
