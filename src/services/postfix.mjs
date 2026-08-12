import { CoreService, addType } from "pmcf";

export class postfix extends CoreService {
  static service = {
    systemdService: "postfix.service",
    systemUserName: "root",
    systemGroupName: "root",
    extends: ["smtp", "smtps", "lmtp", "submission"]
  };

  static {
    addType(this);
  }
}
