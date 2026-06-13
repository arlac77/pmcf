import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { Service } from "../service.mjs";

export class HeadscaleService extends Service {
  static name = "headscale";
  static specializationOf = Service;
  static service = {
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
  };
  static {
    addType(this);
    addServiceType(this.service, this.name);
  }
}
