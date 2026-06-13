import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { Service } from "../service.mjs";

export class postfix extends Service {
  static specializationOf = Service;
  static attributes = {};
  static service = {
    systemdService: "postfix.service",
    extends: ["smtp", "lmtp", "submission"],
    services: {}
  };

  static {
    addType(this);
    addServiceType(this.service, this.name);
  }

  get type() {
    return this.constructor.name;
  }
}
