import { addType } from "./types.mjs";
import { Service, ServiceTypeDefinition } from "./service.mjs";
import { networkAddressType } from "pmcf";

export const ExtraSourceServiceTypeDefinition = {
  name: "extra-source-service",
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {
    source: { type: networkAddressType, collection: true, writable: true }
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
