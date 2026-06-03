import test from "ava";
import { InitializationContext, Host, SystemdResolvedService } from "pmcf";
import { filterConfigurable } from "../src/utils.mjs";

test("systemd-resolved service type", t => {
  const ic = new InitializationContext();
  const service = new SystemdResolvedService(new Host(ic.root));

  t.is(service.systemdService, "systemd-resolved.service");
  t.deepEqual(
    service.types,
    new Set(["systemd-resolved", "dns", "mdns", "llmnr"])
  );

  /*
  service.Resolve = {};
  service.Resolve.DNS = "1.2.3.4";

  t.is(service.extendedAttribute("Resolve.DNS"), "1.2.3.4");
  */
});

test("systemd-resolved basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const resolved = await ic.named("/L1/C1/systemd-resolved");

  t.deepEqual(resolved.systemdConfigs("ABC"), {
    serviceName: "systemd-resolved.service",
    configFileName: "etc/systemd/resolved.conf.d/ABC.conf",
    content: [
      "[Resolve]",
      "DNS=192.168.1.11",
      //    "FallbackDNS=1.1.1.1 2606:4700:4700::1111 8.8.8.8 2001:4860:4860::8888",
      "FallbackDNS=1.1.1.1 8.8.8.8",
      "MulticastDNS=yes",
      "Domains=mydomain.com",
      "DNSSEC=no",
      "LLMNR=yes"
    ]
  });
});
