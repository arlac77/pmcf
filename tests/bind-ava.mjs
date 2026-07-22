import test from "ava";
import { InitializationContext } from "pmcf";
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

test.only("BIND groups", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const bindInst = ic.named("/L1/C1/bind");

  t.is(bindInst.fullName, "/L1/C1/bind");
  t.true(bindInst instanceof bind);
  t.true(bindInst.extends.has(ic.named("/templates/bind")));

  const internalGroup = bindInst.groups.get("internal");
  const protectedGroup = bindInst.groups.get("protected");

  t.deepEqual(
    [...bindInst.groups.keys()],
    ["internal", "protected" /*, "trusted"*/]
  );
  t.is(internalGroup.name, "internal");
  t.is(internalGroup.type, "view");
  t.is(internalGroup.order, 0);

  t.deepEqual(internalGroup.entries, [ic.named("/L1/n1")]);

  const zs = internalGroup.zones;

  const z1 = zs.get("mydomain.com");

  t.is(z1.id, "mydomain.com");
  t.is(z1.file, "n1/mydomain.com.zone");

  t.is(protectedGroup.name, "protected");
  t.is(protectedGroup.type, "view");
  t.is(protectedGroup.sharedWith, internalGroup);
  t.is(protectedGroup.owner, bindInst);
  t.is(protectedGroup.order, 1);

  t.is(internalGroup.entries[0].name, "n1");

  //t.deepEqual(bind.groups.internal.allowedUpdates, [bind.groups.trusted]);

  t.deepEqual(
    bindInst.source.map(s => s.name),
    ["GLOBAL", "n2"]
  );

  /*t.deepEqual(
    addresses(bind.groups.trusted.access, { aggregate: true }).sort(),
    ["192.168.1/24", "127.0.0.1", "::1"].sort()
  );*/

  const n = Math.ceil((Date.now() - 499) / 1000);

  t.deepEqual(
    internalGroup.defaultRecords.map(r => r.toString()),
    [
      `@ 1W IN SOA   c1.mydomain.com. admin.mydomain.com. (${n} 36000 72000 600000 60000)`,
      "@ 1W IN NS    c1.mydomain.com."
    ]
  );
});
