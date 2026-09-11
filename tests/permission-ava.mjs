import test from "ava";
import { permission } from "pmcf";

test("permission basics", async t => {
    const p = new permission();

    p.owner = "hugo";
    t.is(p.owner, "hugo");

    p.group = "grp";
    t.is(p.group, "grp");
});
