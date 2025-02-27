import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

const ClusterTypeDefinition = {
  name: "cluster",
  owners: [Owner.typeDefinition, "network", "root"],
  priority: 0.7,
  extends: Owner.typeDefinition,
  properties: {
    masters: { type: "host", collection: true, writeable: true },
    backups: { type: "host", collection: true, writeable: true },
  }
};

export class Cluster extends Owner {

  masters = new Set();
  backups = new Set();
  
  static {
    addType(this);
  }

  static get typeDefinition() {
    return ClusterTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, ClusterTypeDefinition);
  }
}
