import { Service, addType } from "pmcf";

export class tailscale extends Service {
  static specializationOf = Service;
  static service = {
    endpoints: [
      {
        family: "IPv4",
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
