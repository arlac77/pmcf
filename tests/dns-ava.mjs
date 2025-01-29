import test from "ava";
import { Root } from "pmcf";

test("DNS basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const l1 = await root.named("L1");

  const dnsServices = await Array.fromAsync(l1.dns.services());

  t.deepEqual(
    dnsServices.map(s => s.ipAddresses[0]).sort(),
    ["1.1.1.1", "192.168.1.1", "192.168.1.2", "8.8.8.8"].sort()
  );

  t.deepEqual(await l1.dns.resolvedConfig(), {
    DNS: "",
    FallbackDNS: "1.1.1.1 2606:4700:4700:0000:0000:0000:0000:1111 8.8.8.8 2001:4860:4860:0000:0000:0000:0000:8888 192.168.1.2 192.168.1.1",
    Domains: "",
    DNSSEC: "no",
    MulticastDNS: "yes",
    LLMNR: "no"
});
});
