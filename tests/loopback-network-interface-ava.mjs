import test from "ava";
import {
  InitializationContext,
  Host,
  hosts_attribute,
  loopback,
  assign
} from "pmcf";

test("loopback common names", t => {
  t.false(loopback.isCommonName("eth0"));
  t.true(loopback.isCommonName("lo0"));
  t.true(loopback.isCommonName("loopback"));
});

test("loopback basics", t => {
  const ic = new InitializationContext();

  const h1 = new Host();
  ic.read(h1, {
    name: "h1",
    networkInterfaces: {
      lo: {}
    }
  });
  assign(hosts_attribute, ic.root, h1);

  const lo = h1.networkInterfaces.get("lo");

  t.is(lo.address, "127.0.0.1");

  t.deepEqual([...lo.subnets.keys()], ["127/8", "::1/128"]);

  t.true(lo instanceof loopback);
  t.is(lo.name, "lo");
  t.is(lo.kind, "loopback");
});
