import test from "ava";
import { Root } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Model basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObject(t, await root.named("/model/m1"), root1(root, "/model/m1"));
});
