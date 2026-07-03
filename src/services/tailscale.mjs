import { FAMILY_IPV4 } from "ip-utilties";
import { CoreService, addType } from "pmcf";

export class tailscale extends CoreService {
  static service = {
    endpoints: [
      {
        family: FAMILY_IPV4,
        port: 41641,
        protocol: "tcp",
        tls: false
      }
    ]
  };

  static {
    addType(this);
  }
}
