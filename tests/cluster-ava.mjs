import test from "ava";
import { InitializationContext, Root } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Cluster basics", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const c1 = await ic.named("/L1/C1");

  const p1eth0 = await ic.named("/L1/host1/eth0");
  t.true(c1.masters.indexOf(p1eth0) >= 0);

  await assertObject(t, await ic.named("/L1/C1"), root1(ic.root, "/L1/C1"));
});
