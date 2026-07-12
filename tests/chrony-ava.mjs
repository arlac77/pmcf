import test from "ava";
import { InitializationContext, Endpoint } from "pmcf";
import { chrony } from "../src/services/chrony.mjs";

test("ChronyService basics", async t => {
  const ic = new InitializationContext(new URL("fixtures/root1", import.meta.url).pathname);
  await ic.loadAll();

  const chronyInst = ic.named("/L1/host1/chrony");

  t.true(chronyInst instanceof chrony);
  t.is(chronyInst.typeName, "chrony");
  t.deepEqual(chronyInst.types, new Set(["chrony", "ntp"]));

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
