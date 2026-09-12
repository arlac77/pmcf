import { owner, addType } from "pmcf";

export class root extends owner {
  static priority = 3;
  static {
    addType(this);
  }

  constructor(directory="/") {
    super();
    this.directory = directory;
    this.name = "";
  }

  get fullName() {
    return "";
  }

  named(name) {
    if (name === "" || name === "/") {
      return this;
    }

    return super.named(name);
  }

  get root() {
    return this;
  }
}
