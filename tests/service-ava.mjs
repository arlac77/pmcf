import test from "ava";
import { Root, Location, Host, Service } from "pmcf";

test("Service basics", t => {
  const root = new Root("/somwhere");

  const l1 = new Location(root, {
    name: "l1",
    networks: { ethernet: { subnets: "10.0/16" } }
  });
  root.addObject(l1);

  const h1 = new Host(l1, {
    name: "h1",
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.1/16" } }
  });
  l1.addObject(h1);

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  h1.services = s1;

  t.is(s1.name, "dns");
  t.is(s1.type, "dns");
  t.is(s1.alias, "primary-dns");
  t.is(s1.priority, 3);
  t.is(s1.weight, 5);
  t.is(s1.port, 53);
  t.is(s1.protocol, "udp");
  t.is(s1.srvPrefix, "_dns._udp");
  t.deepEqual(s1.rawAddresses, ["10.0.0.1"]);
  t.deepEqual(s1.addresses, ["10.0.0.1:53"]);

  t.is([...h1.findServices({ type: "dns" })][0], s1);

  const h2 = new Host(l1, {
    name: "h2",
    priority: 19,
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.2" } }
  });

  const s2 = s1.forOwner(h2);
  h2.services = s2;
  t.is(s2.name, "dns");
  t.is(s2.type, "dns");
  t.is(s2.priority, 19);
  t.is(s2.weight, 5);
  t.is(s2.port, 53);
  t.is(s2.protocol, "udp");
  t.is(s2.srvPrefix, "_dns._udp");
  t.deepEqual(s2.rawAddresses, ["10.0.0.2"]);
  t.deepEqual(s2.addresses, ["10.0.0.2:53"]);
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
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: 19 })), [s2]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "=19" })), [
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: ">=19" })), [
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "<20" })), [
    s1,
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "<=20" })), [
    s1,
    s2
  ]);
  t.deepEqual(Array.from(l1.findServices({ type: "dns", priority: "!=19" })), [
    s1
  ]);
  t.deepEqual(Array.from(l1.findServices({ srvPrefix: "_dns._udp" })), [
    s1,
    s2
  ]);

  t.is(s1, l1.findService({ type: "dns" }));

  const s3 = new Service(h1, {
    name: "http3",
    weight: 0,
    priority: 0
  });

  t.is(s3.priority, 0);
  t.is(s3.priority, 0);
  t.is(s3.srvPrefix, "_https._tcp");
});

test("Service without protocol", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.1" } }
  });
  root.addObject(h1);

  const s1 = new Service(h1, { name: "dhcp", weight: 5, priority: 3 });
  t.is(s1.srvPrefix, undefined);
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
    name: "h1"
  });
  root.addObject(h1);

  const h2 = new Host(root, {
    name: "h2"
  });
  root.addObject(h2);

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  const s1b = s1.forOwner(h2);

  t.is(s1b.owner, h2);
});
