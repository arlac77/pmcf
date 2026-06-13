import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { Service } from "../service.mjs";

export class PostfixService extends Service {
  static name = "postfix";
  static priority = 1;
  static specializationOf = Service;
  static owners = Service.owners;
  static key = "name";
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
