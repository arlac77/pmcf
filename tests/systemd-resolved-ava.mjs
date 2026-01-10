import test from "ava";
import { Root, Host, SystemdResolvedService } from "pmcf";
import { filterConfigurable } from "../src/utils.mjs";

test("systemd-resolved service type", t => {
  const root = new Root();
  const h1 = new Host(root);

  const service = new SystemdResolvedService(h1);

  t.is(service.systemdService, "systemd-resolved.service");
  t.deepEqual(service.types, new Set(["systemd-resolved"]));

  service.Resolve.DNS = "1.2.3.4";

  t.is(service.extendedProperty("Resolve.DNS"), "1.2.3.4");
});

test("systemd-resolved basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const resolved = await root.named("/L1/C1/systemd-resolved");

  t.deepEqual(resolved.systemdConfigs("ABC"), {
    serviceName: "systemd-resolved.service",
    configFileName: "etc/systemd/resolved.conf.d/ABC.conf",
    content: [
      "[Resolve]",
      "DNS=192.168.1.11",
      "FallbackDNS=1.1.1.1 2606:4700:4700::1111 8.8.8.8 2001:4860:4860::8888",
      "Domains=mydomain.com",
      "MulticastDNS=yes",
      "DNSSEC=no",
      "LLMNR=yes"
    ]
  });
});
