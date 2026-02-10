import test from "ava";
import { Root } from "pmcf";
import { ALPMService } from "../src/services/alpm.mjs";

test("alpm basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const alpm = await root.named("/L1/host1/alpm");

  t.true(alpm instanceof ALPMService);

  const r1 = alpm.repositories.get("mf-public");
  t.is(r1.name, "mf-public");
  t.deepEqual(r1.architectures, new Set(["aarch64", "x86", "armv7"]));
  t.deepEqual(r1.base, "/binaries/linux/arch/$repo/$arch");
});
