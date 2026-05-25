import test from "ava";
import { InitializationContext, addresses } from "pmcf";
import { BindService } from "../src/services/bind.mjs";

test("BIND basics endpoints", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const bind = await ic.named("/L1/C1/bind");

  t.deepEqual(
    bind.endpoints().map(e => {
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
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const bind = await ic.named("/L1/C1/bind");

  t.is(bind.fullName, "/L1/C1/bind");
  t.true(bind instanceof BindService);

  t.deepEqual(Object.keys(bind.groups), ["internal", "protected", "trusted"]);
  t.is(bind.groups.internal.name, "internal");
  t.is(bind.groups.protected.name, "protected");
  t.is(bind.groups.protected.sharedWith, bind.groups.internal);
  t.is(bind.groups.protected.owner, bind);

  t.is(bind.groups.internal.entries[0].name, "n1");

  t.deepEqual(bind.groups.internal.allowedUpdates, [bind.groups.trusted]);

  t.deepEqual(
    bind.source.map(s => s.name),
    ["GLOBAL", "n2"]
  );

  t.deepEqual(
    addresses(bind.groups.trusted.access, { aggregate: true }).sort(),
    ["192.168.1/24", "127.0.0.1", "::1"].sort()
  );

  const n = Math.ceil((Date.now() - 300) / 1000);

  t.deepEqual(
    bind.groups.internal.defaultRecords.map(r => r.toString()),
    [
      `@ 1W IN SOA   c1.mydomain.com. admin.mydomain.com. (${n} 36000 72000 600000 60000)`,
      "@ 1W IN NS    c1.mydomain.com."
    ]
  );
});
