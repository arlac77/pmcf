import test from "ava";
import { Root, addresses } from "pmcf";
import { BindService } from "../src/services/bind.mjs";

test.only("BIND basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const bind = await root.named("/L1/C1/bind");

  //console.log(bind.endpoints());

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
