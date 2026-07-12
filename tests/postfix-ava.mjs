import test from "ava";
import { InitializationContext } from "pmcf";
import { postfix } from "../src/services/postfix.mjs";

test("postfix basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const postfixInst = ic.named("/L1/host1/postfix");

  t.true(postfixInst instanceof postfix);

  t.is(
    postfixInst.expression("join(',',subnets[family='IPv4'].prefix)"),
    "192.168.1"
  );
});
