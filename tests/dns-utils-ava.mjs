import test from "ava";
import { dnsFormatParameters, dnsMergeParameters } from "../src/dns-utils.mjs";

test("dnsMergeParameters", t => {
  t.deepEqual(dnsMergeParameters({ alpn: "h2" }, { alpn: "h3" }), {
    alpn: new Set(["h2", "h3"])
  });
});

test("dnsFormatParameters", t => {
  t.is(dnsFormatParameters({ "no-default-alpn":undefined, alpn: "h2" }), 'alpn="h2" no-default-alpn');
});
