import { addType } from "pacc";
import { Service } from "../service.mjs";

export class TailscaleService extends Service {
  static name = "tailscale";
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
