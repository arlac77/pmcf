import test from "ava";
import { Root, Host, Service, Endpoint, HTTPEndpoint, DomainNameEndpoint, sortByFamilyAndAddress } from "pmcf";

function prepare() {
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

  return { h1, s1 };
}

test("Endpoint from Service basics", t => {
  const { h1, s1 } = prepare();

  const nas = [...h1.networkAddresses()].sort(sortByFamilyAndAddress);
  const eps = s1.endpoints().sort(sortByFamilyAndAddress);

  //console.log(eps.map(e => e.toString()));

  const options = {
    type: "dns",
    protocol: "udp",
    port: 53,
    tls: false
  };
  t.deepEqual(eps, [
    new DomainNameEndpoint(s1, "h1", options),
    ...nas.map(na => new Endpoint(s1, na, options))
  ]);

  t.is(
    s1.endpoints(e => e.networkInterface.kind === "loopback")[0].hostName,
    "localhost"
  );

  const e1 = s1.endpoints(e => e.family=='IPv4' && e.networkInterface.kind !== "loopback")[0];
  t.is(e1.hostName, "h1");
  t.is(e1.type, "dns");
  t.is(e1.protocol, "udp");
  t.is(e1.port, 53);
  t.is(e1.family, "IPv4");
  t.is(e1.toString(), "dns:IPv4/10.0.0.1[53]");
});

test("HTTPEndpoint basics", t => {
  const { h1, s1 } = prepare();
  const nas = h1.networkAddresses();

  const ep = new HTTPEndpoint(s1, [...nas][0], {
    type: "http-control",
    port: 80,
    pathname: "/p1"
  });

  t.is(ep.type, "http-control");
  t.is(ep.family, "IPv4");
  t.is(ep.port, 80);
  t.is(ep.pathname, "/p1");
  t.is(ep.tls, false);
  t.is(ep.url.toString(), "http://127.0.0.1/p1");
});

test("HTTPEndpoint from URL", t => {
  const { s1 } = prepare();

  const ep = new HTTPEndpoint(s1, "https://somwhere/aPath", {
    type: "http-control"
  });

  t.is(ep.type, "http-control");
  t.is(ep.port, 443);
  t.is(ep.pathname, "/aPath");
  t.is(ep.tls, true);
  t.is(ep.url.toString(), "https://somwhere/aPath");
});

test("HTTPEndpoint from URL with port", t => {
  const { s1 } = prepare();

  const ep = new HTTPEndpoint(s1, "https://somwhere:1443/aPath", {
    type: "http-control"
  });

  t.is(ep.type, "http-control");
  t.is(ep.port, 1443);
  t.is(typeof ep.port, "number");
  t.is(ep.pathname, "/aPath");
  t.is(ep.tls, true);
  t.is(ep.url.toString(), "https://somwhere:1443/aPath");
});
