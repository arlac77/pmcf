import test from "ava";
import { Root, Location, Host, Service, Endpoint } from "pmcf";

test("Service basics", t => {
  const root = new Root("/somwhere");

  const l1 = new Location(root, {
    name: "l1",
    networks: { ethernet: { subnets: "10.0/16" } }
  });
  root.addObject(l1);

  const h1 = new Host(l1, {
    name: "h1",
    networkInterfaces: {
      l0: { ipAddresses: "127.0.0.1", kind: "loopback" },
      eth0: { ipAddresses: "10.0.0.1/16" }
    },
    priority: 19
  });
  l1.addObject(h1);

  const lna = h1.networkAddresses(
    na => na.networkInterface.kind === "loopback" && na.family === 'IPv4'
  );
  const ena = h1.networkAddresses(
    na => na.networkInterface.kind !== "loopback"
  );

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  h1.services = s1;

  t.deepEqual(
    s1.endpoints(e => e.family === "IPv4"),
    [
      ...lna.map(
        a =>
          new Endpoint(s1, a, {
            type: "dns",
            port: 53,
            protocol: "udp",
            tls: false
          })
      ),
      ...ena.map(
        a =>
          new Endpoint(s1, a, {
            type: "dns",
            port: 53,
            protocol: "udp",
            tls: false
          })
      )
    ]
  );

  t.deepEqual(
    s1.dnsRecordsForDomainName("example.com", true).map(r => r.toString()),
    ["_dns._udp.example.com. 1W IN SRV     3   5  53 h1."]
  );

  t.is(s1.name, "dns");
  t.is(s1.type, "dns");
  t.is(s1.alias, "primary-dns");
  t.is(s1.priority, 3);
  t.is(s1.weight, 5);
  t.is(s1.port, 53);
  t.is(s1.protocol, "udp");

  t.deepEqual(s1.addresses, ["127.0.0.1", "::1", "10.0.0.1"]);

  t.deepEqual(
    [...s1.endpoints(e => e.family == "IPv4")].map(e => e.socketAddress),
    ["127.0.0.1:53", "10.0.0.1:53"]
  );

  t.is([...h1.findServices({ type: "dns" })][0], s1);

  const h2 = new Host(l1, {
    name: "h2",
    priority: 3,
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.2" } }
  });

  const s2 = s1.forOwner(h2);
  h2.services = s2;
  t.is(s2.name, "dns");
  t.is(s2.type, "dns");
  t.is(s2.priority, 3);
  t.is(s2.weight, 5);
  t.is(s2.port, 53);
  t.is(s2.protocol, "udp");

  t.deepEqual(
    s2.dnsRecordsForDomainName("example.com", true).map(r => r.toString()),
    ["_dns._udp.example.com. 1W IN SRV     3   5  53 h2."]
  );

  t.deepEqual(s2.addresses, ["10.0.0.2"]);
  t.deepEqual(
    [...s2.endpoints()].map(e => e.socketAddress),
    ["10.0.0.2:53"]
  );
  t.is([...h2.findServices({ type: "dns" })][0], s2);

  t.deepEqual(Array.from(l1.findServices({ type: "dns" })), [s1, s2]);
  t.deepEqual(Array.from(l1.findServices({ name: "dns" })), [s1, s2]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", name: "dns" })), [
    s1,
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", name: "dnsx" })), []);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", name: "dns|http" })), [
    s1,
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", protocol: "udp" })), [
    s1,
    s2
  ]);
  /*
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: 19 })), [s2]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "=19" })), [
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: ">=19" })), [
    s2
  ]);
  */
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "<20" })), [
    s1,
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "<=20" })), [
    s1,
    s2
  ]);
  /*
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "!=19" })), [
    s2
  ]);
  */

  t.is(s1, l1.findService({ type: "dns" }));

  const s3 = new Service(h1, {
    name: "http3",
    weight: 0,
    priority: 0
  });

  t.is(s3.priority, 0);
  t.is(s3.priority, 0);

  t.deepEqual(
    s3.dnsRecordsForDomainName("example.com", true).map(r => r.toString()),
    [
      "_https._tcp.example.com. 1W IN SRV     0   0 443 h1.",
      'example.com. 1W IN HTTPS   0 . alpn="h3" no-default-alpn'
    ]
  );
});

test("Service without protocol", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.1" } }
  });
  root.addObject(h1);

  const na = h1.networkAddresses();

  const s1 = new Service(h1, {
    name: "xyz",
    port: 555,
    weight: 5,
    priority: 3
  });

  t.deepEqual(s1.dnsRecordsForDomainName("example.com", true), [
    //   DNSRecord("_xxx._yyy", "SRV", 3, 5, 555, "example.com")
  ]);

  t.deepEqual(s1.endpoints(), [
    ...na.map(
      a =>
        new Endpoint(s1, a, {
          type: "xyz",
          port: 555,
          tls: false
        })
    )
  ]);
});

test("Service load", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.1" } },
    services: {
      dns: {}
    }
  });
  root.addObject(h1);

  t.is(h1.services[0].name, "dns");

  t.is(h1.typeNamed("service", "dns"), h1.services[0]);
});

test("Service owner", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    priority: 3,
    weight: 5
  });
  root.addObject(h1);

  const h2 = new Host(root, {
    name: "h2",
    priority: 8,
    weight: 7,
    networkInterfces: {
      eth0: { ipAddresses: "10.0.0.1" }
    }
  });
  root.addObject(h2);

  t.is(h2.weight, 7);
  const s1 = new Service(h1, {
    name: "dns",
    alias: "primary-dns"
  });

  const s1b = s1.forOwner(h2);

  t.is(s1b.owner, h2);
  t.is(s1b.name, "dns");
  t.is(s1b.priority, 8);
  t.is(s1b.weight, 7);

  t.deepEqual(s1b.endpoints(), [
    /*new Endpoint(s1b, unknown,{
      port: 53,
      protocol: "udp",
      tls: false
    })*/
  ]);
});
