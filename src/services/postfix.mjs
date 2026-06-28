import { Service, addType } from "pmcf";

export class postfix extends Service {
  static service = {
    systemdService: "postfix.service",
    extends: ["smtp", "lmtp", "submission"],
    services: {}
  };

  static {
    addType(this);
  }
}
