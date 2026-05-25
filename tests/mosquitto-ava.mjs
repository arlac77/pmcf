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
