import test from "ava";
import { Root, LoopbackNetworkInterface } from "pmcf";

test("localhost", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const local = root.named("/LOCAL");
  t.is(local.name, "LOCAL");
  t.is(local.constructor, LoopbackNetworkInterface);
  t.is(local.mtu, 16436);
  t.deepEqual(local.localDomains, new Set(["localhost"]));
  t.is(local.host, undefined);
  t.deepEqual([...local.hosts()], []);

  const dns = Array.from(local.findServices({ type: "dns" }))[0];
  t.is(dns.name, "dns");
});
