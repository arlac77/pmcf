import test from "ava";
import { InitializationContext } from "pmcf";
import { PostfixService } from "../src/services/postfix.mjs";

test("postfix basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const postfix = await ic.named("/L1/host1/postfix");

  t.true(postfix instanceof PostfixService);

  t.is(
    postfix.expression("join(',',subnets[family='IPv4'].prefix)"),
    "192.168.1"
  );
});
