import test from "ava";
import { Root, LoopbackNetworkInterface } from "pmcf";

test("localhost", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const local = root.named("/LOCAL");
  t.is(local.name, "LOCAL");
  t.is(local.constructor, LoopbackNetworkInterface);
  t.deepEqual(local.localDomains, new Set(["localhost"]));

  const dns = Array.from(local.findServices({ type: "dns" }))[0]
  t.is(dns.name, "dns");
});
