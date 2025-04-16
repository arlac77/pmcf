import test from "ava";
import { Root } from "pmcf";
import { addresses } from "../src/network-support.mjs";

test("DNS named", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const dns = await root.named("/L1/C1/dns");

  t.is(dns.fullName, "/L1/C1/dns");

  t.deepEqual(addresses(dns.trusted), ["192.168.1/24", "127.0.0.1"]);
});
