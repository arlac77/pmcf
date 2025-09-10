import test from "ava";
import { Root } from "pmcf";

test("systemd-resolved basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const resolved = await root.named("/L1/C1/systemd-resolved");
  
  t.deepEqual(resolved.systemdConfigs("ABC"), {
    serviceName: "systemd-resolved.service",
    configFileName: "etc/systemd/resolved.conf.d/ABC.conf",
    content: [
      "Resolve",
      {
        DNS: "192.168.1.11",
        FallbackDNS: "1.1.1.1 2606:4700:4700::1111 8.8.8.8 2001:4860:4860::8888",
        Domains: "mydomain.com",
        DNSSEC: "no",
        MulticastDNS: "yes",
        LLMNR: "no"
      }
    ]
  });
});
