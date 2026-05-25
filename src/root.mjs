import { addType } from "pacc";
import { Location } from "./location.mjs";

export class Root extends Location {
  static name = "root";
  static priority = 3;
  static typeDefinition = this;
  
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
