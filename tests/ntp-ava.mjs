import test from "ava";
import { Root } from "pmcf";

test("NTP basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const l1 = await root.named("L1");

  t.deepEqual(l1.ntp.systemdConfig[1], {
    NTP: "2.arch.pool.ntp.org"
  });
});
