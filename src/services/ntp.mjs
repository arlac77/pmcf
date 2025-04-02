import { addType } from "../types.mjs";
import { ServiceTypeDefinition, serviceAddresses } from "../service.mjs";
import { ExtraSourceService, ExtraSourceServiceTypeDefinition } from "../extra-source-service.mjs";

const NTPServiceTypeDefinition = {
  name: "ntp",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

const NTP_SERVICE_FILTER = { type: NTPServiceTypeDefinition.name };

export class NTPService extends ExtraSourceService {
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
          () => true
        ).join(" ")
      }
    ];
  }
}
