import test from "ava";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";
import { InitializationContext } from "pmcf";

test("Location basics", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const l1 = await ic.named("/L1");

  await assertObject(t, l1, root1(ic.root, "/L1"), ["/L1"]);
});

test("Location all", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();
  await assertObjects(t, ic.root.locations, root1(ic.root, ["/L1", "/L2"]));
});
