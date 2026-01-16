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
    mosquitto.extendedAttribute("persistence_location"),
    "/var/lib/mosquitto"
  );

  t.is(
    mosquitto.extendedAttribute("persistence_location"),
    "/var/lib/mosquitto"
  );
  t.is(mosquitto.extendedAttribute("password_file"), "/etc/mosquitto/passwd");
  t.is(mosquitto.extendedAttribute("acl_file"), "/etc/mosquitto/acl");
});
