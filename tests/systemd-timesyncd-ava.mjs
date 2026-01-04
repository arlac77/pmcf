import test from "ava";
import { Root } from "pmcf";

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
