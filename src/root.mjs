import { addType } from "pmcf";
import { Location } from "./location.mjs";

export class root extends Location {
  static priority = 3;
  
  static {
    addType(this);
  }

  constructor(directory) {
    super(undefined, "");
    this.directory = directory;
    this.addObject(this);
  }

  get fullName() {
    return "";
  }

  get root() {
    return this;
  }
}
