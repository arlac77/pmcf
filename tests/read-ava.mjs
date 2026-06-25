import test from "ava";
import {
  string_attribute,
  string_collection_attribute_writable,
  string_set_attribute_writable,
  default_attribute_writable
} from "pacc";
import { Base, addType } from "pmcf";
import { InitializationContext } from "../src/initialization-context.mjs";

export class MyType extends Base {
  static attributes = {
    undefStrings: {
      ...string_collection_attribute_writable,
      name: "undefStrings"
    },
    aString: { ...string_attribute, name: "aString", writable: true },
    aStringWitwDefault: {
      ...string_attribute,
      name: "aStringWitwDefault",
      default: "xyz",
      writable: true
    },

    arrayStrings: {
      ...string_collection_attribute_writable,
      name: "arrayStrings"
    },
    setStrings: { ...string_set_attribute_writable, name: "setStrings" },
    objects: {
      ...default_attribute_writable,
      name: "objects",
      collection: true,
      type: Base
    }
  };

  static {
    addType(this);
  }

  objects = new Map();
  arrayStrings = [];
  setStrings = new Set();
}

test("read basics", t => {
  const ic = new InitializationContext();
  const m1 = new MyType();

  const data = {
    aString: "s1",
    undefStrings: "s2",
    arrayStrings: "s3",
    setStrings: ["s41", "s42"],
    objects: [{ name: "o1" }, { name: "o2" }]
  };

  ic.read(m1, data, MyType);

  t.is(m1.aString, "s1");
  t.is(m1.aStringWitwDefault, "xyz");
  t.deepEqual(m1.undefStrings, ["s2"]);
  t.deepEqual(m1.arrayStrings, ["s3"]);
  t.deepEqual(m1.setStrings, new Set(["s41", "s42"]));

  t.is(m1.named("o1"), m1.objects.get("o1"));
  t.is(m1.named("o2"), m1.objects.get("o2"));
});
