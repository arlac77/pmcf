import { setBaseService, CoreService, addType } from "pmcf";
import { serviceTypes, ServiceTypes } from "./service-types.mjs";

export class Service extends CoreService {
  static name = "service";
  static {
    addType(this);
    setBaseService(this);
  }

  _type;
  _types;

  set types(value) {
    this._types = value;
  }

  get types() {
    if (this._types) {
      this._types.add(this.type);
      return this._types;
    }
    if (this._type) {
      return new Set([this._type]);
    }

    const types = serviceTypes(ServiceTypes[this.type]);

    if(types.size) {
      return types;
    }

    return new Set([this.name]);
  }

  set type(value) {
    this._type = value;
  }

  get type() {
    return this.attribute("_type") ?? this.name;
  }
}
