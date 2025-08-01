import test from "ava";
import { string_attribute, string_collection_attribute_writable } from "pacc";
import { Root, Base } from "pmcf";
import { addType } from "../src/types.mjs";

const MyTypeDefinition = {
  name: "mytype",
  owners: [],
  priority: 0.9,
  extends: Base.typeDefinition,
  properties: {
    aString: { ...string_attribute, writable: true },
    aStringWitwDefault: { ...string_attribute, default: "xyz", writable: true },
    arrayStrings: string_collection_attribute_writable,
    undefStrings: string_collection_attribute_writable,
    setStrings: string_collection_attribute_writable
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
  t.is(m1.aStringWitwDefault, "xyz");
  t.deepEqual(m1.undefStrings, ["s2"]);
  t.deepEqual(m1.arrayStrings, ["s3"]);
  // t.deepEqual(m1.setStrings, ["s41", "s42"]);
});
