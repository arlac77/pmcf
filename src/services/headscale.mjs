import { FAMILY_IPV4 } from "ip-utilties";
import { CoreService, addType } from "pmcf";

export class headscale extends CoreService {
  static service = {
    endpoints: [
      {
        family: "unix",
        path: "/run/headscale/headscale.sock"
      },
      {
        family: FAMILY_IPV4,
        port: 8080,
        protocol: "tcp",
        tls: false
      },
      {
        description: "grpc",
        family: FAMILY_IPV4,
        port: 50443,
        protocol: "tcp",
        tls: false
      },
      {
        description: "metrics debug",
        family: FAMILY_IPV4,
        port: 9090,
        protocol: "tcp",
        tls: false
      }
    ]
  };
  static {
    addType(this);
  }
}
