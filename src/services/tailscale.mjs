import { addType } from "pacc";
import { ServiceTypeDefinition, Service } from "../service.mjs";

export class TailscaleService extends Service {
  static name = "tailscale";
  static extends = ServiceTypeDefinition;
  static specializationOf = ServiceTypeDefinition;
  static owners = ServiceTypeDefinition.owners;
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

  /*static {
    addType(TailscaleService);
  }*/
}
