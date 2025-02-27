import test from "ava";
import { Root } from "pmcf";

test("load basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  t.is(await root.load("/"), root);
});

test("load all", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);

  await root.loadAll();

  const location1 = await root.named("/L1");
  t.is(location1.owner, root);
  t.is(location1.name, "L1");
  t.is(location1.fullName, "/L1");

  const host1 = await root.named("/L1/host1");
  t.is(host1.owner, location1);
  t.is(host1.name, "host1");
  t.is(host1.fullName, "/L1/host1");

  const network1 = await root.named("/L1/n1");
  t.is(network1.owner, location1);
  t.is(network1.name, "n1");
  t.is(network1.fullName, "/L1/n1");

  const host2 = await root.named("/L1/n1/host2");
  t.is(host2.owner, network1);
  t.is(host2.name, "host2");
  t.is(host2.fullName, "/L1/n1/host2");
});
