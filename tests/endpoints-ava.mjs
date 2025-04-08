import test from "ava";
import { Root, Host, Service, Endpoint } from "pmcf";

test("Service basics", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: {
      l0: { ipAddresses: "127.0.0.1", kind: "loopback", scope: "host" },
      eth0: { ipAddresses: "10.0.0.1/16" }
    },
    priority: 19
  });
  root.addObject(h1);

  const l0 = h1.networkInterfaces.get("l0");
  const eth0 = h1.networkInterfaces.get("eth0");

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  h1.services = s1;

  t.deepEqual(s1.endpoints, [
    new Endpoint(s1, l0, {
      rawAddress: "127.0.0.1",
      type: "dns",
      port: 53,
      protocol: "udp",
      tls: false
    }),
    new Endpoint(s1, l0, {
      rawAddress: "::1",
      type: "dns",
      port: 53,
      protocol: "udp",
      tls: false
    }),
    new Endpoint(s1, eth0, {
      type: "dns",
      port: 53,
      protocol: "udp",
      tls: false
    })
  ]);

  t.is(s1.endpoints.find(e => e.networkInterface === l0).hostName, "localhost");
  t.is(s1.endpoints.find(e => e.networkInterface === eth0).hostName, "h1");
});
