import test from "ava";
import {
  Root,
  Host,
  Network,
  Service,
  ServiceTypes,
  addServiceType,
  Endpoint,
  HTTPEndpoint,
  DomainNameEndpoint,
  UnixEndpoint,
  sortByFamilyAndAddress
} from "pmcf";

function prepare() {
  const root = new Root("/somwhere");

  const n1 = new Network(root);
  n1.read({
    name: "n1",
    subnets: "10.0/16"
  });
  root.addObject(n1);

  addServiceType({}, "http-control");
  const h1 = new Host(root);
  h1.read({
    name: "h1",
    networkInterfaces: {
      lo: {},
      eth0: { network: "/n1", ipAddresses: "10.0.0.1/16" }
    },
    priority: 19
  });
  root.addObject(h1);

  const s1 = new Service(h1);
  s1.read({
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
    type: ServiceTypes.dns,
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

  const e1 = s1.endpoints(
    e => e.family == "IPv4" && e.networkInterface.kind !== "loopback"
  )[0];
  t.is(e1.hostName, "h1");
  t.is(e1.type, "dns");
  t.is(e1.protocol, "udp");
  t.is(e1.port, 53);
  t.is(e1.family, "IPv4");
  t.is(e1.priority, 3);
  t.is(e1.toString(), "dns:IPv4/10.0.0.1[53]");
});

test("HTTPEndpoint basics", t => {
  const { h1, s1 } = prepare();
  const nas = h1.networkAddresses();

  const ep = new HTTPEndpoint(s1, [...nas][0], {
    type: ServiceTypes["http-control"],
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
    type: ServiceTypes["http-control"]
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
    type: ServiceTypes["http-control"]
  });

  t.is(ep.type, "http-control");
  t.is(ep.port, 1443);
  t.is(typeof ep.port, "number");
  t.is(ep.pathname, "/aPath");
  t.is(ep.tls, true);
  t.is(ep.url.toString(), "https://somwhere:1443/aPath");
});

test("DomainNameEndpoint", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root);
  h1.read({
    name: "h1"
    /* networkInterfaces: {
      eth0: { ipAddresses: "10.0.0.1/16" }
    }*/
  });
  root.addObject(h1);

  const s1 = new Service(h1, {
    name: "ntp"
  });

  h1.services = s1;

  const options = {
    port: 123,
    type: ServiceTypes.ntp,
    protocol: "udp",
    tls: false
  };

  t.deepEqual(s1.endpoint(), new DomainNameEndpoint(s1, "h1", options));
});

test("UnixEndpoint", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root);
  h1.read({
    name: "h1"
  });
  root.addObject(h1);

  const s1 = new Service(h1, {
    name: "ntp"
  });

  h1.services = s1;

  const options = {
    type: ServiceTypes.ntp,
    path: "/run/xyz",
    family: "unix",
    scheme: "ldapi",
    tls: false
  };

  const e1 = new UnixEndpoint(s1, "/run/xyz", options);

  t.deepEqual(e1.url, "ldapi:/run/xyz");
});
