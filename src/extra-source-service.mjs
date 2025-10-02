import { default_attribute_writable } from "pacc";
import { addType } from "./types.mjs";
import { Service, ServiceTypeDefinition } from "./service.mjs";
import { networkAddressType } from "pmcf";

export const ExtraSourceServiceTypeDefinition = {
  name: "extra-source-service",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  priority: 0.1,
  attributes: {
    source: {
      ...default_attribute_writable,
      type: networkAddressType,
      collection: true
    }
  }
};

export class ExtraSourceService extends Service {
  _source = [];

  static {
    addType(this);
  }

  static get typeDefinition() {
    return ExtraSourceServiceTypeDefinition;
  }

  get type() {
    return ExtraSourceServiceTypeDefinition.name;
  }

  set source(value) {
    this._source.push(value);
  }

  get source() {
    return this._source;
  }

  *findServices(filter) {
    yield* this.owner.owner.findServices(filter);

    for (const s of this.source) {
      yield* s.findServices(filter);
    }
  }
}
