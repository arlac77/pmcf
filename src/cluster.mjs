import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";
import { writeLines } from "./utils.mjs";

const ClusterTypeDefinition = {
  name: "cluster",
  owners: [Owner.typeDefinition, "network", "location", "root"],
  priority: 0.7,
  extends: Owner.typeDefinition,
  properties: {
    masters: { type: "network_interface", collection: true, writeable: true },
    backups: { type: "network_interface", collection: true, writeable: true }
  }
};

export class Cluster extends Owner {
  #masters = new Set();
  #backups = new Set();

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

  set masters(value) {
    this.#masters.add(value);
  }

  get masters() {
    return this.#masters;
  }

  set backups(value) {
    this.#backups.add(value);
  }

  get backups() {
    return this.#backups;
  }

  async *preparePackages(stagingDir) {
    for await (const result of super.preparePackages(stagingDir)) {
      for (const ni of this.masters.union(this.backups)) {
        const name = `${this.typeName}-${this.owner.name}-${this.name}-${ni.host.name}`;
        const packageStagingDir = join(stagingDir, name);
        const cfg = [
          `vrrp_instance ${this.name} {`,
          `  state ${this.masters.has(ni) ? "MASTER" : "BACKUP"}`,
          `  interface ${ni.name}`,
          "  virtual_router_id 101",
          "  priority 255",
          "  advert_int 1",
          "  authentication {",
          "    auth_type PASS",
          "    auth_pass pass1234",
          "  }",
          "  virtual_ipaddress {",
          `    ${ni.rawAddress}`,
          "  }",
          "}"
        ];

        await writeLines(
          join(packageStagingDir, "etc/keepalived"),
          "keepalived.conf",
          cfg
        );

        result.properties.name = name;
        result.properties.dependencies = ["keepalived"];

        result.sources.push(
          new FileContentProvider(packageStagingDir + "/")[
            Symbol.asyncIterator
          ]()
        );

        yield result;
      }
    }
  }
}
