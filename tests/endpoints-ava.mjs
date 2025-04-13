import test from "ava";
import { Root, Host, Service, Endpoint } from "pmcf";

test("Service basics", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: {
      l0: { kind: "loopback" },
      eth0: { ipAddresses: "10.0.0.1/16" }
    },
    priority: 19
  });
  root.addObject(h1);

  const loa = h1.networkAddresses(n => n.networkInterface.kind === "loopback");
  const etha = h1.networkAddresses(n => n.networkInterface.kind !== "loopback");

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  h1.services = s1;

  t.deepEqual(s1.endpoints(), [
    ...loa.map(
      na =>
        new Endpoint(s1, na, {
          address: "127.0.0.1",
          type: "dns",
          port: 53,
          protocol: "udp",
          tls: false
        })
    ),
    ...etha.map(
      na =>
        new Endpoint(s1, na, {
          type: "dns",
          port: 53,
          protocol: "udp",
          tls: false
        })
    )
  ]);

  t.is(
    s1.endpoints(e => e.networkInterface.kind === "loopback")[0].hostName,
    "localhost"
  );
  t.is(
    s1.endpoints(e => e.networkInterface.kind !== "loopback")[0].hostName,
    "h1"
  );
});
