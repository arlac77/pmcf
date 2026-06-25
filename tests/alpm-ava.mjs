import test from "ava";
import { InitializationContext } from "pmcf";
import { alpm } from "../src/services/alpm.mjs";

test("alpm read", async t => {
  const ic = new InitializationContext();
  const a = new alpm();

  ic.read(a, {
    repositories: {
      r1: {
        base: "/binaries/linux/arch/$repo/$arch",
        architectures: ["aarch64", "x86", "armv7"]
      }
    }
  });

  const r1 = a.repositories.get("r1");
  t.is(r1.name, "r1");

  t.deepEqual(r1.architectures, new Set(["aarch64", "x86", "armv7"]));
});

test("alpm basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const alpmInst = await ic.root.named("/L1/host1/alpm");

  t.true(alpmInst instanceof alpm);

  const r1 = alpmInst.repositories.get("mf-public");
  t.is(r1.name, "mf-public");
  t.is(r1.base, "/binaries/linux/arch/$repo/$arch");
  t.deepEqual(r1.architectures, new Set(["aarch64", "x86", "armv7"]));
});
