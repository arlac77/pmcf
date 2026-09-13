import { FAMILY_IPV4 } from "ip-utilties";
import { CoreService, addType } from "pmcf";
import { FAMILY_UNIX, PROTOCOL_TCP } from "../constants.mjs";

export class headscale extends CoreService {
  static service = {
    endpoints: [
      {
        family: FAMILY_UNIX,
        path: "/run/headscale/headscale.sock"
      },
      {
        family: FAMILY_IPV4,
        port: 8080,
        protocol: PROTOCOL_TCP,
        tls: false
      },
      {
        description: "grpc",
        family: FAMILY_IPV4,
        port: 50443,
        protocol: PROTOCOL_TCP,
        tls: false
      },
      {
        description: "metrics debug",
        family: FAMILY_IPV4,
        port: 9090,
        protocol: PROTOCOL_TCP,
        tls: false
      }
    ]
  };
  static {
    addType(this);
  }
}
