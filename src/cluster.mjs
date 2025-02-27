import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

const typeDefinition = {
  name: "cluster",
  owners: [Owner.typeDefinition, "network", "root"],
  priority: 0.7,
  extends: Owner.typeDefinition,
  properties: {}
};

export class Cluster extends Owner {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return typeDefinition;
  }

}
