import { addType } from "../types.mjs";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const HeadscaleServiceTypeDefinition = {
  name: "headscale",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  service: {
    endpoints: [
      {
        family: "unix",
        path: "/run/headscale/headscale.sock"
      },
      {
        family: "IPv4",
        port: 8080,
        protocol: "tcp",
        tls: false
      },
      {
        description: "grpc",
        family: "IPv4",
        port: 50443,
        protocol: "tcp",
        tls: false
      },
      {
        description: "metrics debug",
        family: "IPv4",
        port: 9090,
        protocol: "tcp",
        tls: false
      }
    ]
  }
};

export class HeadscaleService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return HeadscaleServiceTypeDefinition;
  }
}
