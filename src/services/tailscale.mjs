import { FAMILY_IPV4 } from "ip-utilties";
import { Service, addType } from "pmcf";

export class tailscale extends Service {
  static specializationOf = Service;
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
