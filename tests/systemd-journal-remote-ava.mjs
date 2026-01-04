import test from "ava";
import { Root } from "pmcf";

test("systemd-journal-remote", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const journalRemote = await root.named("/L1/C1/systemd-journal-remote");

  t.deepEqual(journalRemote.systemdConfigs("ABC"), [
    {
      serviceName: "systemd-journal-remote.service",
      configFileName: "etc/systemd/journal-remote.conf.d/ABC.conf",
      content: [
        "Remote",
        {
          Seal: false,
          SplitMode: "host",
          ServerKeyFile: "/etc/ssl/server.key"
        }
      ]
    }
  ]);
});
