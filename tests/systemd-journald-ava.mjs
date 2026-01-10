import test from "ava";
import { Root, Host, SystemdJournaldService } from "pmcf";

test("systemd-journald service type", t => {
  const root = new Root();
  const h1 = new Host(root);

  const service = new SystemdJournaldService(h1);

  t.is(service.systemdService, "systemd-journald.service");
  t.deepEqual(service.types, new Set(["systemd-journald"]));
});

test("systemd-journald", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const journalUpload = await root.named("/L1/C1/systemd-journald");

  t.deepEqual(journalUpload.systemdConfigs("ABC"), {
    serviceName: "systemd-journald.service",
    configFileName: "etc/systemd/journal.conf.d/ABC.conf",
    content: [
      "Journal",
      {
        SplitMode: "host"
      }
    ]
  });
});
