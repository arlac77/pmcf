import test from "ava";
import {
  normalizeCIDR,
  isLinkLocal,
  encodeIPv6,
  decodeIPv6
} from "../src/utils.mjs";

function nt(t, address, expected) {
  const { cidr } = normalizeCIDR(address);
  t.is(cidr, expected);
}

nt.title = (providedTitle = "normalizeCIDR", address, cidr) =>
  `${providedTitle} ${address} => ${cidr}`.trim();

test(nt, "127.0.0.1", "127/8");
test(nt, "::1", "0000:0000:0000:0000:0000:0000:0000:0001/127");
test(nt, "1.2.3.4", undefined);
test(nt, "1.2.3.4/24", "1.2.3/24");
test(nt, "1.2.3.4/16", "1.2/16");
test(nt, "10.0/16", "10.0/16");
test(nt, "1.2.3.4/8", "1/8");
test(nt, "192.168.1.62/30", "192.168.1.60/30");
test(nt, "fe80::/64", "fe80:0000:0000:0000/64");

function lt(t, address, expected) {
  t.is(isLinkLocal(address), expected);
}

lt.title = (providedTitle = "isLinkLocal", address, expected) =>
  `${providedTitle} ${address} => ${expected}`.trim();

test(lt, "1.2.3.4", false);
test(lt, "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64", true);
test(lt, "fe80:::1e57:3eff:fe22:9a8f/64", true);
test(lt, "fe80:::1e57:3eff:fe22:9a8f", true);

function e6t(t, address, expected) {
  t.is(encodeIPv6(address), expected);
}

e6t.title = (providedTitle = "encodeIPv6", address, expected) =>
  `${providedTitle} ${address} => ${expected}`.trim();

test(e6t, "::1", 1n);
test(e6t, "::1:1", 1n + (1n << 16n));
test(e6t, "1::", 1n << (128n - 16n));

test("decode ipv6", t => {
  t.is(
    decodeIPv6(0xf000e000d000c000b000an),
    "0000:0000:000f:000e:000d:000c:000b:000a"
  );
});
