import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

const ClusterTypeDefinition = {
  name: "cluster",
  owners: [Owner.typeDefinition, "network", "root"],
  priority: 0.7,
  extends: Owner.typeDefinition,
  properties: {
    masters: { type: "host", collection: true, writeable: true },
    backups: { type: "host", collection: true, writeable: true }
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

  get packageName() {
    return `${this.constructor.typeDefinition.name}-${this.owner.name}-${this.name}`;
  }

  async preparePackage(stagingDir) {
    const result = await super.preparePackage(stagingDir);

    const cfg = [
      "vrrp_instance VI_1 {",
      "  state MASTER",
      "  interface end0",
      "  virtual_router_id 101",
      "  priority 255",
      "  advert_int 1",
      "  authentication {",
      "    auth_type PASS",
      "    auth_pass pass1234",
      "  }",
      "  virtual_ipaddress {",
      "    192.168.1.250",
      "  }",
      "}"
    ];

    await writeLines(join(targetDir, "etc/keepalived"), "keepalived.conf", cfg);

    result.properties.dependencies = ["keepalived"];

    return result;
  }
}
