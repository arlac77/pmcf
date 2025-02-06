import test from "ava";
import { normalizeCIDR } from "../src/utils.mjs";

function nt(t, address, expected) {
  const { cidr } = normalizeCIDR(address);
  t.is(cidr, expected);
}

nt.title = (providedTitle = "normalizeCIDR", address, cidr) =>
  `${providedTitle} ${address} => ${cidr}`.trim();

test(nt, "1.2.3.4", undefined);
test(nt, "1.2.3.4/30", "1.2.3/30");
test(nt, "1.2.3.4/26", "1.2.3/26");
test(nt, "1.2.3.4/25", "1.2.3/25");
test(nt, "1.2.3.4/24", "1.2.3/24");
test(nt, "1.2.3.4/16", "1.2/16");
test(nt, "1.2.3.4/8", "1/8");
