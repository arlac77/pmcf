import test from "ava";
import { InitializationContext, SystemdJournalUploadService } from "pmcf";

test("systemd-journal-upload service type", t => {
  const service = new SystemdJournalUploadService();

  t.is(service.systemdService, "systemd-journal-upload.service");
  t.deepEqual(service.types, new Set(["systemd-journal-upload"]));
});

test("systemd-journal-upload", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const journalUpload = await ic.named("/L1/C1/systemd-journal-upload");

  t.deepEqual(journalUpload.systemdConfigs("ABC"), {
    serviceName: "systemd-journal-upload.service",
    configFileName: "etc/systemd/journal-upload.conf.d/ABC.conf",
    content: [
      "[Upload]",
      "URL=https://journal.examle.com/",
      "ServerKeyFile=/etc/ssl/c1.mydomain.com.key"
    ]
  });
});
