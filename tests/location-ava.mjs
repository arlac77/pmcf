import test from "ava";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";
import { InitializationContext } from "pmcf";

test("Location basics", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const l1 = await ic.named("/L1");

  await assertObject(t, l1, root1(ic.root, "/L1"), ["/L1"]);
});

