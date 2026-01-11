import test from "ava";
import { Root } from "pmcf";
import { ALPMRepositoryService } from "../src/services/alpm-repo.mjs";

test("alpm reposirtory basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const alpm = await root.named("/L1/host1/alpm-repo");

  t.true(alpm instanceof ALPMRepositoryService);

  //console.log(alpm.endpoints());
});
