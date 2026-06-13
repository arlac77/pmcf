import { default_attribute_writable, addType } from "pacc";
import { Service } from "./service.mjs";
import { networkAddressType } from "pmcf";

export class ExtraSourceService extends Service {
  static name = "extra-source-service";
  static extends = Service;
  static specializationOf = Service;
  static owners = Service.owners;
  static attributes = {
    source: {
      ...default_attribute_writable,
      type: networkAddressType,
      collection: true
    }
  };

  static {
    addType(this);
  }

  source = [];

  get type() {
    return this.constructor.name;
  }

  get services() {
    return [
      this.owner.owner.services,
      ...this.source.map(s => s.services)
    ].flat();
  }
}
