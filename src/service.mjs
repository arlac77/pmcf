import { string_attribute_writable } from "pacc";
import { setBaseService, CoreService, addType } from "pmcf";

export class Service extends CoreService {
  static name = "service";
  static attributes = {
    type: { ...string_attribute_writable, name: "type" }
  };
  static {
    addType(this);

    setBaseService(this);
  }

  _type;

  set type(value) {
    this._type = value;
  }

  set type(value) {
    this._type = value;
  }

  get type() {
    return this.attribute("_type") ?? this.name;
  }
}
