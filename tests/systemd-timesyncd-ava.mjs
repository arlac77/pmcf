import test from "ava";

import { Root, Host, SystemdTimesyncdService } from "pmcf";

test("systemd-timesyncd service type", t => {
  const root = new Root();
  const h1 = new Host(root);

  const service = new SystemdTimesyncdService(h1);

  t.is(service.systemdService, "systemd-timesyncd.service");
  t.deepEqual(service.types, new Set(["systemd-timesyncd"]));
});

test("systemd-timesyncd basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const ntp = await root.named("/L1/C1/systemd-timesyncd");

  t.deepEqual(ntp.systemdConfigs("ABC"), {
    serviceName: "systemd-timesyncd.service",
    configFileName: "etc/systemd/timesyncd.conf.d/ABC.conf",
    content: [
      "Time",
      {
        NTP: "192.168.1.11 c1.mydomain.com",
        FallbackNTP: '2.arch.pool.ntp.org'
      }
    ]
  });
});
