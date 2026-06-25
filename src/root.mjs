import { Owner, addType } from "pmcf";

export class root extends Owner {
  static priority = 3;
  static {
    addType(this);
  }

  constructor(directory) {
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
