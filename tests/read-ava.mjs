import test from "ava";
import { Root, Base } from "pmcf";
import { addType } from "../src/types.mjs";

const MyTypeDefinition = {
  name: "mytype",
  owners: [],
  priority: 0.9,
  extends: Base.typeDefinition,
  properties: {
    aString: { type: "string", collection: false, writeable: true },
    strings: { type: "string", collection: true, writeable: true }
  }
};

export class MyType extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return MyTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, MyTypeDefinition);
  }
}

test("read basics", t => {
  const root = new Root("/");
  const m1 = new MyType(root, { aString: "s1", strings: "s2" });
  t.is(m1.aString, "s1");
//  t.is(m1.strings, ["s2"]);
});
