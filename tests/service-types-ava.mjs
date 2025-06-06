import test from "ava";
import { ServiceTypes } from "pmcf";

test("ServiceTypes registered", t => {
  t.truthy(ServiceTypes.dns);
  t.truthy(ServiceTypes.bind);
  t.truthy(ServiceTypes.kea);
});
