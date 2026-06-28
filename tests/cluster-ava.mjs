import test from "ava";
import { InitializationContext, root as Root } from "pmcf";
import { assertObject } from "./util.mjs";
import { root1 } from "./fixtures.mjs";

test("Cluster basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const c1 = ic.named("/L1/C1");

  t.deepEqual([...c1.owner.hosts.keys()].sort(), ["C1", "host1", "host2"]);

  const p1eth0 = ic.named("/L1/host1/eth0");
  t.is(p1eth0.network.name, "n1");
  t.is(p1eth0.network.owner.name, "L1");
  t.true(c1.masters.indexOf(p1eth0) >= 0);

  await assertObject(t, ic.named("/L1/C1"), root1(ic.root, "/L1/C1"));
});
