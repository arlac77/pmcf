import test from "ava";
import { Root } from "pmcf";

test("DNS basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const l1 = await root.named("L1");

  const dnsServices = Array.from(l1.dns.findServices({ type: "dns" }));

  t.deepEqual(
    dnsServices.map(s => s.rawAddress).sort(),
    ["1.1.1.1", "192.168.1.1", "8.8.8.8"].sort()
  );

  t.deepEqual(l1.dns.systemdConfig[1], {
    DNS: "192.168.1.1",
    FallbackDNS:
      "1.1.1.1 2606:4700:4700:0000:0000:0000:0000:1111 8.8.8.8 2001:4860:4860:0000:0000:0000:0000:8888",
    Domains: "mydomain.com",
    DNSSEC: "no",
    MulticastDNS: "yes",
    LLMNR: "no"
  });
});

test("DNS named", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const dns = await root.named("/L1/dns");

  t.is(dns.fullName, "/L1/dns");
});
