import test from "ava";
import { InitializationContext } from "pmcf";
import { bind } from "../src/services/bind.mjs";

test("BIND basics endpoints", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const bindInst = await ic.named("/L1/C1/bind");

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

test("BIND groups", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const bindInst = await ic.named("/L1/C1/bind");

  //console.log([...bindInst.extends].map(e=>e.fullName));
  t.is(bindInst.fullName, "/L1/C1/bind");
  t.true(bindInst instanceof bind);

  const internalGroup = bindInst.groups.get("internal");
  const protectedGroup = bindInst.groups.get("protected");

  t.deepEqual(
    [...bindInst.groups.keys()],
    ["internal", "protected", "trusted"]
  );
  t.is(internalGroup.name, "internal");
  t.is(protectedGroup.name, "protected");
  t.is(protectedGroup.sharedWith, internalGroup);
  t.is(protectedGroup.owner, bindInst);

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

  const n = Math.ceil((Date.now() - 300) / 1000);

  t.deepEqual(
    internalGroup.defaultRecords.map(r => r.toString()),
    [
      `@ 1W IN SOA   c1.mydomain.com. admin.mydomain.com. (${n} 36000 72000 600000 60000)`,
      "@ 1W IN NS    c1.mydomain.com."
    ]
  );
});
