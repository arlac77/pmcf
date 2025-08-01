import { addType } from "./types.mjs";
import { Service, ServiceTypeDefinition } from "./service.mjs";

export const ExtraSourceServiceTypeDefinition = {
  name: "extra-source-service",
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {
    source: { type: "network", collection: true, writable: true }
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

  constructor(owner, data) {
    super(owner, data);
    this.read(data, ExtraSourceServiceTypeDefinition);
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
