import test from "ava";
import { InitializationContext } from "pmcf";
import { influxdb } from "../src/services/influxdb.mjs";

test("influxdb basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const inst = await ic.named("/L1/host1/influxdb");

  t.true(inst instanceof influxdb);
  t.is(inst.port, 8086);
  t.is(inst.url.toString(), "http://192.168.1.1:8086/");

  t.is(inst.metricsDisabled, true);
});
