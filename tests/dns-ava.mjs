import test from "ava";
import { World } from "pmcf";

test("Location dns", async t => {
  const world = new World(new URL("fixtures/world1", import.meta.url).pathname);

  const l1 = await world.named("L1");

  const dnsServices = await Array.fromAsync(l1.dns.services());

  t.deepEqual(
    dnsServices.map(s => s.ipAddresses[0]).sort(),
    ["1.1.1.1", "192.168.1.1", "192.168.1.2", "8.8.8.8"].sort()
  );
});
