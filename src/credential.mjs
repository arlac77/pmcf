import { string_attribute_writable } from "pacc";
import { base } from "./base.mjs";
import { addType } from "./type.mjs";

export class credential extends base {
  static attributes = {
    localName: { ...string_attribute_writable, name: "localName" }
  };

  static {
    addType(this);
  }

  get localName() {
    return this._localName ?? this.name;
  }

  set localName(value) {
    this._localName = value;
  }
}
