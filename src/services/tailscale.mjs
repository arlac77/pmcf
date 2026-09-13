import { FAMILY_IPV4 } from "ip-utilties";
import { CoreService, addType } from "pmcf";
import { PROTOCOL_TCP } from "../constants.mjs";

export class tailscale extends CoreService {
  static service = {
    endpoints: [
      {
        family: FAMILY_IPV4,
        port: 41641,
        protocol: PROTOCOL_TCP,
        tls: false
      }
    ]
  };

  static {
    addType(this);
  }
}
