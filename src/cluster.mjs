import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Owner } from "./owner.mjs";
import { Host } from "./host.mjs";
import { addType } from "./types.mjs";
import { writeLines } from "./utils.mjs";

const ClusterTypeDefinition = {
  name: "cluster",
  owners: [Owner.typeDefinition, "network", "location", "root"],
  priority: 0.7,
  extends: Owner.typeDefinition,
  properties: {
    routerId: { type: "number", collection: false, writeable: true },
    masters: { type: "network_interface", collection: true, writeable: true },
    backups: { type: "network_interface", collection: true, writeable: true }
  }
};

export class Cluster extends Host {
  #masters = new Set();
  #backups = new Set();
  routerId = 100;

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
    
    const result = {
      sources: [],
      outputs: this.outputs,
      properties: {
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private"
      }
    };
  
    let interfaces = new Set();

    for(const cluster of this.owner.clusters()) {
      interfaces = interfaces.union(cluster.masters.union(cluster.backups));
    }

    for (const ni of interfaces) {
      const name = `keepalived-${ni.host.name}`;
      const packageStagingDir = join(stagingDir, name);
  
      const cfg = [];

      for(const cluster of this.owner.clusters()) {
        cfg.push(`vrrp_instance ${cluster.name} {`);
        cfg.push(`  state ${cluster.masters.has(ni) ? "MASTER" : "BACKUP"}`);
        cfg.push(`  interface ${ni.name}`,);
        cfg.push("  virtual_ipaddress {");
        cfg.push(`    ${cluster.rawAddress}`);
        cfg.push("  }");
        cfg.push(`  virtual_router_id ${this.routerId}`);
        cfg.push("  priority 255");
        cfg.push("  advert_int 1");
        cfg.push("  authentication {");
        cfg.push("    auth_type PASS");
        cfg.push("    auth_pass pass1234");
        cfg.push("  }");
        cfg.push("}");
        cfg.push("");
      }

      await writeLines(
        join(packageStagingDir, "etc/keepalived"),
        "keepalived.conf",
        cfg
      );

      result.properties.name = name;
      result.properties.dependencies = ["keepalived"];

      result.sources.push(
        new FileContentProvider(packageStagingDir + "/")[Symbol.asyncIterator]()
      );

      yield result;
    }
  }
}
