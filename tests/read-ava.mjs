import test from "ava";
import {
  string_attribute,
  string_collection_attribute_writable,
  string_set_attribute_writable,
  addType
} from "pacc";
import { Root, Base } from "pmcf";
import { InitializationContext } from "../src/initialization-context.mjs";

const MyTypeDefinition = {
  name: "mytype",
  extends: Base.typeDefinition,
  key: "name",
  attributes: {
    aString: { ...string_attribute, writable: true },
    aStringWitwDefault: { ...string_attribute, default: "xyz", writable: true },
    arrayStrings: string_collection_attribute_writable,
    undefStrings: string_collection_attribute_writable,
    setStrings: string_set_attribute_writable
  }
};

export class MyType extends Base {
  static typeDefinition = MyTypeDefinition;
  static {
    addType(this);
  }

  arrayStrings = [];
  setStrings = new Set();
}

test("read basics", t => {
  const ic = new InitializationContext();

  const root = new Root("/");
  const m1 = new MyType(root);

  const data = {
    aString: "s1",
    undefStrings: "s2",
    arrayStrings: "s3",
    setStrings: ["s41", "s42"]
  };

  ic.read(m1, data, MyType.typeDefinition);

  t.is(m1.aString, "s1");
  t.is(m1.aStringWitwDefault, "xyz");
  t.deepEqual(m1.undefStrings, ["s2"]);
  t.deepEqual(m1.arrayStrings, ["s3"]);
  t.deepEqual(m1.setStrings, new Set(["s41", "s42"]));
});
