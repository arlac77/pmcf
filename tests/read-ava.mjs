import test from "ava";
import {
  string_attribute,
  string_collection_attribute_writable,
  string_set_attribute_writable,
  default_attribute_writable,
  addType
} from "pacc";
import { root, Base } from "pmcf";
import { InitializationContext } from "../src/initialization-context.mjs";

export class MyType extends Base {
  static attributes = {
    aString: { ...string_attribute, writable: true },
    aStringWitwDefault: { ...string_attribute, default: "xyz", writable: true },
    arrayStrings: string_collection_attribute_writable,
    undefStrings: string_collection_attribute_writable,
    setStrings: string_set_attribute_writable,
    objects: { ...default_attribute_writable, collection: true, type: Base }
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
  const rootInst = new root("/");
  const m1 = new MyType(rootInst);

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

  t.deepEqual(
    [...m1.objects.values()],
    [new Base(m1, "o1"), new Base(m1, "o2")]
  );

  t.is(m1.named("o1"), m1.objects.get("o1"));
  t.is(m1.named("o2"), m1.objects.get("o2"));
});
