import test from "ava";
import { Root } from "pmcf";
import { InfluxdbService } from "../src/services/influxdb.mjs";

test("influxdb basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const influxdb = await root.named("/L1/host1/influxdb");

  t.true(influxdb instanceof InfluxdbService);
  t.is(influxdb.port, 8086);
  t.is(influxdb.url.toString(), "http://192.168.1.1:8086/");

  t.is(influxdb.metricsDisabled, true);
});
