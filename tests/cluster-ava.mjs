import test from "ava";
import { Root } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Cluster basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const c1 = await root.named("/L1/C1");
  //console.log(c1);

  const p1eth0 = await root.named("/L1/C1/p1/eth0");
  t.true(c1.masters.has(p1eth0));

  await assertObject(t, await root.named("/L1/C1"), root1(root, "/L1/C1"));
});
