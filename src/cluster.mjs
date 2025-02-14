import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

export class Cluster extends Owner {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return {
      name: "cluster",
      extends: Owner,
      properties: {}
    };
  }

  constructor(owner, data) {
    super(owner, data);
    owner.addObject(this);
  }
}
