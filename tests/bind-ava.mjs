import test from "ava";
import { InitializationContext, addresses } from "pmcf";
import { bind } from "../src/services/bind.mjs";

test("BIND basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const bindInst = ic.named("/L1/C1/bind");

  t.is(bindInst.systemdService, "named.service");
  t.is(bindInst.systemUserName, "named");
  t.is(bindInst.systemGroupName, "named");

  t.deepEqual(
    bindInst.endpoints().map(e => {
      return {
        type: e.type,
        port: e.port,
        address: e.address /*, family: e.family*/
      };
    }),
    [
      {
        type: "bind-statistics",
        address: "c1.mydomain.com",
        port: 19521
      },
      /*  {
        type: "bind-rdnc",
        address: "192.168.1.11",
        port: 953
      },*/
      {
        type: "dns",
        address: "192.168.1.11",
        port: 53
      }
      /* {
        type: "dns",
        address: "c1.mydomain.com",
        port: 53
      }*/
    ]
  );
});

test("BIND keys acls and views", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const bindInst = ic.named("/L1/C1/bind");

  t.is(bindInst.fullName, "/L1/C1/bind");
  t.true(bindInst instanceof bind);
  t.true(bindInst.extends.has(ic.named("/templates/bind")));

  t.is(bindInst.serverType, "secondary");

  const rndc = bindInst.keys.get("rndc");
  t.is(rndc.name, "rndc");
  t.is(rndc.secret, "abc");

  t.deepEqual([...bindInst.acls.keys()], ["trusted", "protected"]);

  const trustedACL = bindInst.acls.get("trusted");
  t.is(trustedACL.name, "trusted");
  t.is(trustedACL.order, 0);

  //console.log(addresses(trustedACL.entries, { aggregate: true }));

  t.deepEqual(addresses(trustedACL.entries, { aggregate: true }), [
    "fe80::/64",
    "192.168.1/24"
  ]);

  const internalView = bindInst.views.get("internal");
  const protectedView = bindInst.views.get("protected");

  t.deepEqual(
    [...bindInst.views.keys()],
    ["internal", "protected", "trusted"]
  );
  t.is(internalView.name, "internal");
  t.is(internalView.order, 0);
  t.is(internalView.type, "secondary");

  t.deepEqual([...internalView.entries.map(e => e.address)], ["192.168.1.2"]);
  t.deepEqual(internalView.domains, new Set(["mydomain.com"]));

  const zs = internalView.zones;

  const z1 = zs.get("mydomain.com");

  t.is(z1.id, "mydomain.com");
  t.is(z1.file, "internal/mydomain.com.raw");
  t.is(z1.type, "secondary");

  t.is(protectedView.name, "protected");
  t.is(protectedView.type, "secondary");
  t.is(protectedView.sharedWith, internalView);
  t.is(protectedView.owner, bindInst);
  t.is(protectedView.order, 1);

  const addr = [...bindInst.forwarders]
    .map(e => e.endpoints())
    .flat()
    .filter(e => e.networkAddress)
    .map(e => e.networkAddress?.address);

  t.deepEqual(addr, [
    "8.8.8.8",
    "2001:4860:4860::8888",
    "1.1.1.1",
    "2606:4700:4700::1111"
  ]);

  /*t.deepEqual(
    addresses(bind.views.trusted.access, { aggregate: true }).sort(),
    ["192.168.1/24", "127.0.0.1", "::1"].sort()
  );*/

  const n = Math.ceil((Date.now() - 499) / (1000 * 60)) * 60;

  t.deepEqual(
    internalView.defaultRecords.map(r => r.toString()),
    [
      `@ 1W IN SOA   c1.mydomain.com. admin.mydomain.com. (${n} 36000 72000 600000 60000)`,
      "@ 1W IN NS    c1.mydomain.com."
    ]
  );
});
