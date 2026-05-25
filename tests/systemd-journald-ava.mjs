import test from "ava";
import { InitializationContext, Host, SystemdJournaldService } from "pmcf";

test("systemd-journald service type", t => {
  const ic = new InitializationContext();
  const service = new SystemdJournaldService(new Host(ic.root));

  t.is(service.systemdService, "systemd-journald.service");
  t.deepEqual(service.types, new Set(["systemd-journald"]));
});

test("systemd-journald", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const journalUpload = await ic.named("/L1/C1/systemd-journald");

  t.deepEqual(journalUpload.systemdConfigs("ABC"), {
    serviceName: "systemd-journald.service",
    configFileName: "etc/systemd/journal.conf.d/ABC.conf",
    content: ["[Journal]", "SplitMode=host"]
  });
});
