import test from "ava";
import { mosquitto } from "../src/services/mosquitto.mjs";
import { InitializationContext } from "pmcf";

test("mosquitto basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const mosquittoInst = ic.named("/L1/host1/mosquitto");

  t.true(mosquittoInst instanceof mosquitto);
  t.is(mosquittoInst.alias, "mqtt");
  t.is(mosquittoInst.listener, 1883);

  t.is(mosquittoInst.attribute("persistence_location"), "/var/lib/mosquitto");

  t.is(mosquittoInst.attribute("persistence_location"), "/var/lib/mosquitto");
  t.is(mosquittoInst.attribute("password_file"), "/etc/mosquitto/passwd");
  t.is(mosquittoInst.attribute("acl_file"), "/etc/mosquitto/acl");
});
