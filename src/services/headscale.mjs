import { addType } from "../types.mjs";
import { ServiceTypeDefinition } from "../service.mjs";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition
} from "../extra-source-service.mjs";

const HeadscaleServiceTypeDefinition = {
  name: "headscale",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  attributes: {},
  service: {
    endpoints: [
      {
        family: "IPv4",
        port: 8080,
        protocol: "tcp",
        tls: false
      },
      {
        family: "IPv4",
        port: 50443,
        protocol: "tcp",
        tls: false
      }
    ]
  }
};

export class HeadscaleService extends ExtraSourceService {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return HeadscaleServiceTypeDefinition;
  }
}
