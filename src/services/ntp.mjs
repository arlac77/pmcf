import { addType } from "../types.mjs";
import {
  Service,
  ServiceTypeDefinition,
  serviceAddresses
} from "../service.mjs";

const NTPServiceTypeDefinition = {
  name: "ntp",
  owners: ServiceTypeDefinition.owners,
  priority: 0.1,
  properties: {
    source: { type: "network", collection: true, writeable: true }
  }
};

const NTP_SERVICE_FILTER = { type: NTPServiceTypeDefinition.name };

export class NTPService extends Service {
  _source = [];

  static {
    addType(this);
  }

  static get typeDefinition() {
    return NTPServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NTPServiceTypeDefinition);
  }

  get type() {
    return NTPServiceTypeDefinition.name;
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

  get systemdConfig() {
    return [
      "Time",
      {
        NTP: serviceAddresses(
          this,
          {
            ...NTP_SERVICE_FILTER,
            priority: "<20"
          },
          "domainName",
          ()=>true
        ).join(" ")
      }
    ];
  }
}
