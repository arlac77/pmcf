import test from "ava";
import { Root, Endpoint } from "pmcf";
import { ChronyService } from "../src/services/chrony.mjs";

test("ChronyService basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const chrony = await root.named("/L1/host1/chrony");

  //console.log([...chrony.findServices("type='ntp'"")]);
  t.true(chrony instanceof ChronyService);
  t.deepEqual(chrony.types, new Set(["chrony", "ntp"]));

  //t.is(chrony.expression("endpoints[type='ntp']"), ["1.2.3.4"]);
  /*
  t.deepEqual(
    chrony.endpoint("ntp"),
    new Endpoint(chrony, [...chrony.host.networkAddresses()][0], {
      type: "ntp"
    })
  );
  */
});
