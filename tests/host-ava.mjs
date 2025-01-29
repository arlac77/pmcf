import test from "ava";
import { Root } from "pmcf";
import { assertObject, assertObjects } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Host minimal", async t => {
  const root = new Root(new URL("fixtures/minimal", import.meta.url).pathname);
  await root.loadAll();

  const host1 = root.named("L1/host1");

  t.is(host1.name, "host1");
});

test("Host basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  await assertObject(
    t,
    await root.named("L1/host1"),
    root1(root, "L1/host1")
  );
});

test("Host all", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();
  await assertObjects(
    t,
    root.hosts(),
    root1(root, ["L1/n1/host2", "L1/host1"])
  );
});
