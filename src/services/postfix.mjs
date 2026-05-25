import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const PostfixServiceTypeDefinition = {
  name: "postfix",
  priority: 1,
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {},
  service: {
    systemdService: "postfix.service",
    extends: ["smtp", "lmtp", "submission"],
    services: {}
  }
};

export class PostfixService extends Service {
  static typeDefinition = PostfixServiceTypeDefinition;
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  get type() {
    return PostfixServiceTypeDefinition.name;
  }
}
