import test from "ava";
import { Root, Host, Service, Endpoint, HTTPEndpoint } from "pmcf";

test("Endpoint from Service basics", t => {
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

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  h1.services = s1;

  //console.log(s1.endpoints().map(e => e.toString()));

  const nas = h1.networkAddresses();
  const eps = s1.endpoints();

  t.deepEqual(eps, [
    ...nas.map(
      na =>
        new Endpoint(s1, na, {
          protocol: "udp",
          port: 53,
          tls: false
        })
    )
  ]);

  t.is(
    s1.endpoints(e => e.networkInterface.kind === "loopback")[0].hostName,
    "localhost"
  );

  const e1 = s1.endpoints(e => e.networkInterface.kind !== "loopback")[0];
  t.is(e1.hostName, "h1");
  t.is(e1.type, "dns");
  t.is(e1.protocol, "udp");
  t.is(e1.port, 53);
  t.is(e1.family, "IPv4");
  t.is(e1.toString(), "dns:IPv4/10.0.0.1[53]");
});

test("HTTPEndpoint basics", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: {
      l0: { kind: "loopback" }
    },
    priority: 19
  });
  root.addObject(h1);

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3
  });

  h1.services = s1;

  const nas = h1.networkAddresses();

  const ep = new HTTPEndpoint(s1, [...nas][0], { type: "http-control", port: 80, path: "/p1" });

  t.is(ep.type, "http-control");
  t.is(ep.port, 80);
  t.is(ep.path, "/p1");
  t.is(ep.url, "http://127.0.0.1:80/p1");
});
