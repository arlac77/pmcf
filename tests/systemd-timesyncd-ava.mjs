import test from "ava";

import {
  InitializationContext,
  Host,
  SystemdTimesyncdService,
  assign,
  ServiceOwner
} from "pmcf";

test("systemd-timesyncd service type", t => {
  const ic = new InitializationContext();
  const h1 = new Host();
  const service = new SystemdTimesyncdService();
  assign(ServiceOwner.attributes.services, h1, service);

  t.is(service.systemdService, "systemd-timesyncd.service");
  t.deepEqual(service.types, new Set(["systemd-timesyncd"]));
});

test("systemd-timesyncd basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const ntp = ic.named("/L1/C1/systemd-timesyncd");

  t.deepEqual(ntp.systemdConfigs("ABC"), {
    serviceName: "systemd-timesyncd.service",
    configFileName: "etc/systemd/timesyncd.conf.d/ABC.conf",
    content: [
      "[Time]",
      "NTP=192.168.1.11 c1.mydomain.com",
      "FallbackNTP=2.arch.pool.ntp.org"
    ]
  });
});
