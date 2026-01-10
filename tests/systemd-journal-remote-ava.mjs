import test from "ava";
import {
  Root,
  Host,
  SystemdJournalRemoteService,
  ServiceTypes,
  serviceTypeEndpoints
} from "pmcf";

test("systemd-journal-remote service type", t => {
  const root = new Root();
  const h1 = new Host(root);

  const service = new SystemdJournalRemoteService(h1);

  t.deepEqual(service.types, new Set(["systemd-journal-remote"]));

  t.is(service.systemdService, "systemd-journal-remote.service");
  t.is(ServiceTypes[service.type].endpoints[0].port, 19532);
  t.is(serviceTypeEndpoints(ServiceTypes[service.type])[0].port, 19532);
});

test("systemd-journal-remote", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const journalRemoteTemplate = await root.named(
    "/services/systemd-journal-remote/systemd-journal-remote"
  );

  t.is(journalRemoteTemplate.isTemplate, true);
  t.is(journalRemoteTemplate.type, "systemd-journal-remote");
  t.is(journalRemoteTemplate.name, "systemd-journal-remote");
  t.is(journalRemoteTemplate.alias, "journal");
  t.is(
    journalRemoteTemplate.TrustedCertificateFile,
    "/etc/ssl/certs/chain.cert.pem"
  );

  const journalRemote = await root.named("/L1/C1/systemd-journal-remote");

  t.is(journalRemote.isTemplate, false);
  t.is(journalRemote.type, "systemd-journal-remote");
  t.is(journalRemote.name, "systemd-journal-remote");
  t.is(journalRemote.alias, "journal");
  t.is(journalRemote.extendedProperty("Seal"), false);
  t.is(journalRemote.extendedProperty("SplitMode"), "host");
  t.is(
    journalRemote.extendedProperty("TrustedCertificateFile"),
    "/etc/ssl/certs/chain.cert.pem"
  );
  t.is(journalRemote.ServerKeyFile, "/etc/ssl/server.key");

  t.deepEqual(
    journalRemote.extends.map(s => s.name),
    ["systemd-journal-remote"]
  );

  t.deepEqual(journalRemote.extends, [journalRemoteTemplate]);

  t.deepEqual(journalRemote.systemdConfigs("ABC"), {
    serviceName: "systemd-journal-remote.service",
    configFileName: "etc/systemd/journal-remote.conf.d/ABC.conf",
    content: [
      "[Remote]",
      "Seal=false",
      "SplitMode=host",
      "ServerKeyFile=/etc/ssl/server.key",
      "TrustedCertificateFile=/etc/ssl/certs/chain.cert.pem"
    ]
  });
});
