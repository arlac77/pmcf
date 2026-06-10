import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

export class PostfixService extends Service {
  static name = "postfix";
  static priority = 1;
  static extends = ServiceTypeDefinition;
  static specializationOf = ServiceTypeDefinition;
  static owners = ServiceTypeDefinition.owners;
  static key = "name";
  static attributes = {};
  static service = {
    systemdService: "postfix.service",
    extends: ["smtp", "lmtp", "submission"],
    services: {}
  };

  static typeDefinition = this;
  static {
    addType(this);
    addServiceType(this.service, this.name);
  }

  get type() {
    return this.constructor.name;
  }
}
