import test from "ava";
import { Root, Base } from "pmcf";
import { addType } from "../src/types.mjs";

const MyTypeDefinition = {
  name: "mytype",
  owners: [],
  priority: 0.9,
  extends: Base.typeDefinition,
  properties: {
    aString: { type: "string", collection: false, writable: true },
    arrayStrings: { type: "string", collection: true, writable: true },
    undefStrings: { type: "string", collection: true, writable: true },
    setStrings: { type: "string", collection: true, writable: true }
  }
};

export class MyType extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return MyTypeDefinition;
  }

  arrayStrings = [];
  setStrings = new Set();
  constructor(owner, data) {
    super(owner, data);
    this.read(data, MyTypeDefinition);
  }
}

test("read basics", t => {
  const root = new Root("/");
  const m1 = new MyType(root, {
    aString: "s1",
    undefStrings: "s2",
    arrayStrings: "s3",
    setStrings: ["s41", "s42"]
  });
  t.is(m1.aString, "s1");
  t.deepEqual(m1.undefStrings, ["s2"]);
  t.deepEqual(m1.arrayStrings, ["s3"]);
 // t.deepEqual(m1.setStrings, ["s41", "s42"]);
});
