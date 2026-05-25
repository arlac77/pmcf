import test from "ava";
import { InitializationContext } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Model basics", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();
  await assertObject(t, await ic.named("/model/m1"), root1(ic.root, "/model/m1"));
});
