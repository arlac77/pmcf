import { Base } from "./base.mjs";
import { addType } from "./types.mjs";
import { serviceAddresses } from "./service.mjs";

const NTPServiceTypeDefinition = {
  name: "ntp",
  owners: ["location", "owner", "network", "cluster", "root"],
  priority: 0.1,
  properties: {
    source: { type: "network", collection: true, writeable: true }
  }
};

const NTP_SERVICE_FILTER = { type: NTPServiceTypeDefinition.name };

export class NTPService extends Base {
  #source = [];

  static {
    addType(this);
  }

  static get typeDefinition() {
    return NTPServiceTypeDefinition;
  }

  constructor(owner, data) {
    if (!data.name) {
      data.name = NTPServiceTypeDefinition.name; // TODO
    }
    super(owner, data);
    this.read(data, NTPServiceTypeDefinition);

    owner.addObject(this);
  }

  set source(value) {
    this.#source.push(value);
  }

  get source() {
    return this.#source;
  }

  *findServices(filter) {
    yield* this.owner.findServices(filter);

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
          "domainName"
        ).join(" ")
      }
    ];
  }
}
