import { CoreService, addType } from "pmcf";

export class postfix extends CoreService {
  static service = {
    systemdService: "postfix.service",
    extends: ["smtp", "lmtp", "submission"],
    services: {}
  };

  static {
    addType(this);
  }
}
