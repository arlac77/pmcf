import test from "ava";
import { Root, addresses } from "pmcf";
import { BindService } from "../src/services/bind.mjs";

test("BIND basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const bind = await root.named("/L1/C1/bind");

  t.deepEqual(
    bind.endpoints().map(e => {
      return { type: e.type, port: e.port, address: e.address /*, family: e.family*/ };
    }),
    [
      /*{
        type: "bind-statistics",
        address: "192.168.1.11",
        port: 19521
      },
      {
        type: "bind-rdnc",
        address: "192.168.1.11",
        port: 953
      },*/
      {
        type: "dns",
        address: "192.168.1.11",
        port: 53
      },
      {
        type: "dns",
        address: "C1.mydomain.com",
        port: 53
      }
    ]
  );

  t.true(bind instanceof BindService);
});

test("BIND named", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const bind = await root.named("/L1/C1/bind");

  t.is(bind.fullName, "/L1/C1/bind");

  t.deepEqual(addresses(bind.trusted, { aggregate: true }), [
    "192.168.1/24",
    "127.0.0.1",
    "::1"
  ]);
});
