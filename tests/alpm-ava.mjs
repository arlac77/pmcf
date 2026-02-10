import test from "ava";
import { Root } from "pmcf";
import { ALPMService } from "../src/services/alpm.mjs";

test("alpm basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const alpm = await root.named("/L1/host1/alpm");

  t.true(alpm instanceof ALPMService);
  //console.log(alpm._repositories);

  //console.log(alpm.endpoints());
});
