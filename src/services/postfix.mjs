import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const PostfixServiceTypeDefinition = {
  name: "postfix",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {},
  service: {
    systemdService: "postfix.service",
    extends: ["smtp", "lmpt", "submission"],
    services: {}
  }
};

export class PostfixService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return PostfixServiceTypeDefinition;
  }

  get type() {
    return PostfixServiceTypeDefinition.name;
  }
}
