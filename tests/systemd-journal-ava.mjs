import test from "ava";
import { Root, Host, SystemdJournalService } from "pmcf";

test("systemd-journal service type", t => {
  const root = new Root();
  const h1 = new Host(root);

  const service = new SystemdJournalService(h1);

  t.deepEqual(service.types, new Set(["systemd-journal"]));
});

test("systemd-journal", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const journalUpload = await root.named("/L1/C1/systemd-journal");

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
