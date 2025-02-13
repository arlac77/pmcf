import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

export class Cluster extends Owner {
  static {
    addType(this);
  }

  static get typeName() {
    return "cluster";
  }

  constructor(owner, data) {
    super(owner, data);
    owner.addObject(this);
  }
}
