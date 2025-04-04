import test from "ava";
import {
  normalizeCIDR,
  isLinkLocal,
  encodeIPv6,
  decodeIP,
  encodeIP,
  hasWellKnownSubnet,
  isLocalhost
} from "../src/utils.mjs";

function nt(t, address, expected) {
  const { cidr } = normalizeCIDR(address);
  //console.log(`<${cidr}>`);
  t.is(cidr, expected);
}

nt.title = (providedTitle = "normalizeCIDR", address, cidr) =>
  `${providedTitle} ${address} => ${cidr}`.trim();

test(nt, "127.0.0.1", "127/8");
test(nt, "127/8", "127/8");
test(nt, "::1", "::1/128");
test(nt, "1.2.3.4", undefined);
test(nt, "1.2.3.4/24", "1.2.3/24");
test(nt, "1.2.3.4/16", "1.2/16");
test(nt, "10.0/16", "10.0/16");
test(nt, "1.2.3.4/8", "1/8");
test(nt, "192.168.1.62/30", "192.168.1.60/30");
test(nt, "fe80::/64", "fe80::/64");

function lt(t, address, expected) {
  t.is(isLinkLocal(address), expected);
}
lt.title = (providedTitle = "isLinkLocal", address, expected) =>
  `${providedTitle} ${address} => ${expected}`.trim();

test(lt, "1.2.3.4", false);
test(lt, "fe80:0000:0000:0000:1e57:3eff:fe22:9a8f/64", true);
test(lt, "fe80:::1e57:3eff:fe22:9a8f/64", true);
test(lt, "fe80:::1e57:3eff:fe22:9a8f", true);
test(lt, 0xfe800000000000001e573efffe229a8fn, true);

function e6t(t, address, expected) {
  t.is(encodeIPv6(address), expected);
}

e6t.title = (providedTitle = "encodeIPv6", address, expected) =>
  `${providedTitle} ${address} => ${expected}`.trim();

test(e6t, "::1", 1n);
test(e6t, "::1:1", 1n + (1n << 16n));
test(e6t, "1::", 1n << (128n - 16n));

function dt(t, address, expected) {
  //console.log(decodeIP(address));
  t.is(decodeIP(encodeIP(address)), expected);
}

dt.title = (providedTitle = "decode", address, expected) =>
  `${providedTitle} ${address.toString(16)} => ${expected}`.trim();

test(dt, 0xfe800000000000000000000000000000n,"fe80::")
test(dt, 0x20010db8000000000001000000000001n, "2001:db8::1:0:0:1");
test(dt, 0xf000e000d000c000b000an, "::f:e:d:c:b:a");
test(dt, 0xf000e0000000c000b000an, "::f:e:0:c:b:a");
test(dt, 0xd000c000b000an, "::d:c:b:a");
test(dt, 0xc000b000an, "::c:b:a");
test(dt, 0x000an, "::a");

test("wellKnownSubnet", t => {
  t.true(hasWellKnownSubnet("::1"));
  t.true(hasWellKnownSubnet("127.0.0.1"));
  t.true(hasWellKnownSubnet("fe80::1e57:3eff:fe22:9a8f"));
  t.false(hasWellKnownSubnet("1.2.3.4"));
});


function ilt(t, address, expected) {
  t.is(isLocalhost(address), expected);
}
ilt.title = (providedTitle = "isLocalhost", address, expected) =>
  `${providedTitle} ${address} => ${expected}`.trim();

test(ilt, "127.0.0.1", true);
test(ilt, "", false);
test(ilt, undefined, false);
test(ilt, 2, false);
test(ilt, "1.2.3.4", false);
test(ilt, "::1", true);
test(ilt, 0x1n, true);
