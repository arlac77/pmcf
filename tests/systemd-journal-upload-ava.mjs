import test from "ava";
import { Root } from "pmcf";

test("systemd-journal-upload", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const journalUpload = await root.named("/L1/C1/systemd-journal-upload");

  t.deepEqual(journalUpload.systemdConfigs("ABC"), {
    serviceName: "systemd-journal-upload.service",
    configFileName: "etc/systemd/journal-upload.conf.d/ABC.conf",
    content: [
      "Upload",
      {
        URL: "https://journal.examle.com/",
        ServerKeyFile: "/etc/ssl/c1.mydomain.com.key"
      }
    ]
  });
});
