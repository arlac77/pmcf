import { addType } from "pacc";
import { Service } from "../service.mjs";

export class TailscaleService extends Service {
  static name = "tailscale";
  static priority = 1;
  static specializationOf = Service;
  static owners = Service.owners;
  static key = "name";
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
