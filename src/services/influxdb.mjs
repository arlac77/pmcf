import { addType } from "../types.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const InfluxdbServiceTypeDefinition = {
  name: "influxdb",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {},
  service: {
    endpoints: [
      {
        port: 8086,
        protocol: "tcp",
        tls: false
      }
    ]
  }
};

export class InfluxdbService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return InfluxdbServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, InfluxdbServiceTypeDefinition);
  }

  get type() {
    return InfluxdbServiceTypeDefinition.name;
  }
}
