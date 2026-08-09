import { setBaseService, CoreService, addType } from "pmcf";

export class Service extends CoreService {
  static name = "service";
  static {
    addType(this);
    setBaseService(this);
  }

  _type;

  set type(value) {
    this._type = value;
  }

  get type() {
    return this.attribute("_type") ?? this.name;
  }
}
