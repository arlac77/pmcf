import test from "ava";
import { Root, Location, Host, Service } from "pmcf";

test("Service basics", async t => {
  const root = new Root("/somwhere");

  const l1 = new Location(root, {
    name: "l1",
    networks: { ethernet: { subnets: "10.0/16" } }
  });

  const h1 = new Host(l1, {
    name: "h1",
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.1/16" } }
  });

  const s1 = new Service(h1, {
    name: "dns",
    weight: 5,
    priority: 3,
    alias: "primary-dns"
  });

  t.is(s1.name, "dns");
  t.is(s1.type, "dns");
  t.is(s1.alias, "primary-dns");
  t.is(s1.priority, 3);
  t.is(s1.weight, 5);
  t.is(s1.port, 53);
  t.is(s1.protocol, "udp");
  t.is(s1.srvPrefix, "_dns._udp");
  t.deepEqual(s1.ipAddresses, ["10.0.0.1"]);
  t.deepEqual(s1.addresses, ["10.0.0.1:53"]);

  t.is([...h1.services({ type: "dns" })][0], s1);

  const h2 = new Host(l1, {
    name: "h2",
    priority: 19,
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.2" } }
  });

  const s2 = s1.forOwner(h2);

  t.is(s2.name, "dns");
  t.is(s2.type, "dns");
  t.is(s2.priority, 19);
  t.is(s2.weight, 5);
  t.is(s2.port, 53);
  t.is(s2.protocol, "udp");
  t.is(s2.srvPrefix, "_dns._udp");
  t.deepEqual(s2.ipAddresses, ["10.0.0.2"]);
  t.deepEqual(s2.addresses, ["10.0.0.2:53"]);
  t.is([...h2.services({ type: "dns" })][0], s2);

  const services = await Array.fromAsync(l1.services({ type: "dns" }));

  t.deepEqual(services, [s1, s2]);

  t.is(s1, await l1.service({ type: "dns" }));
});

test("Service without protocol", t => {
  const root = new Root("/somwhere");

  const h1 = new Host(root, {
    name: "h1",
    networkInterfaces: { eth0: { ipAddresses: "10.0.0.1" } }
  });
  const s1 = new Service(h1, { name: "dhcp", weight: 5, priority: 3 });
  t.is(s1.srvPrefix, undefined);
});
