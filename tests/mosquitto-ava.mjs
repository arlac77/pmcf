import test from "ava";
import { Root } from "pmcf";
import { MosquittoService } from "../src/services/mosquitto.mjs";

test("mosquitto basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const mosquitto = await root.named("/L1/host1/mosquitto");

  t.true(mosquitto instanceof MosquittoService);
  t.is(mosquitto.alias, "mqtt");
  t.is(mosquitto.listener, 1883);

  t.is(
    mosquitto.extendedProperty("persistence_location"),
    "/var/lib/mosquitto"
  );

  t.is(
    mosquitto.extendedProperty("persistence_location"),
    "/var/lib/mosquitto"
  );
  t.is(mosquitto.extendedProperty("password_file"), "/etc/mosquitto/passwd");
  t.is(mosquitto.extendedProperty("acl_file"), "/etc/mosquitto/acl");
});
