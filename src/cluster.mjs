import { Owner } from "./owner.mjs";

export class Cluster extends Owner {
  static get typeName() {
    return "cluster";
  }

  constructor(owner, data) {
    super(owner, data);

    owner.addCluster(this);
  }
}
