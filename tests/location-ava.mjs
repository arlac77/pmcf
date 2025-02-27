import test from "ava";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";
import { Root } from "pmcf";

test("Location basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObject(t, await root.named("/L1"), root1(root, "/L1"), ["/L1"]);
});

test("Location all", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObjects(t, root.locations(), root1(root, ["/L1", "/L2"]));
});
