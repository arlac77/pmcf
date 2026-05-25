import test from "ava";
import { InitializationContext, LoopbackNetworkInterface } from "pmcf";

test("localhost", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const local = ic.named("/LOCAL");
  t.is(local.name, "LOCAL");
  t.is(local.constructor, LoopbackNetworkInterface);
  t.is(local.mtu, 16436);
  t.deepEqual(local.localDomains, new Set(["localhost"]));
  t.is(local.host, undefined);
  t.deepEqual([...local.hosts], []);

  const dns = local.expression('services[types[dns]][0]');
  t.is(dns.name, "dns");
});
