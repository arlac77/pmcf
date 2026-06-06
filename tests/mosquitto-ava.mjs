import test from "ava";
import { MosquittoService } from "../src/services/mosquitto.mjs";
import { InitializationContext } from "pmcf";

test("mosquitto basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const mosquitto = await ic.named("/L1/host1/mosquitto");

  t.true(mosquitto instanceof MosquittoService);
  t.is(mosquitto.alias, "mqtt");
  t.is(mosquitto.listener, 1883);

  t.is(
    mosquitto.attribute("persistence_location"),
    "/var/lib/mosquitto"
  );

  t.is(
    mosquitto.attribute("persistence_location"),
    "/var/lib/mosquitto"
  );
  t.is(mosquitto.attribute("password_file"), "/etc/mosquitto/passwd");
  t.is(mosquitto.attribute("acl_file"), "/etc/mosquitto/acl");
});
