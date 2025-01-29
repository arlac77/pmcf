import test from "ava";
import { Root } from "pmcf";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Cluster basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  await assertObject(t, await root.named("L1/C1"), root1(root, "L1/C1"));
});
