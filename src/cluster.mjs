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

  get members() {
    return this.masters.union(this.backups);
  }

  async *preparePackages(stagingDir) {
    const result = {
      sources: [],
      properties: {
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private"
      }
    };

    let interfaces = new Set();

    for (const cluster of this.owner.clusters()) {
      interfaces = interfaces.union(cluster.masters.union(cluster.backups));
    }

    for (const ni of interfaces) {
      const host = ni.host;
      const name = `keepalived-${host.name}`;
      const packageStagingDir = join(stagingDir, name);

      const cfg = [];

      for (const cluster of [...this.owner.clusters()].sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        cfg.push(`vrrp_instance ${cluster.name} {`);
        cfg.push(`  state ${cluster.masters.has(ni) ? "MASTER" : "BACKUP"}`);
        cfg.push(`  interface ${ni.name}`);
        cfg.push("  virtual_ipaddress {");
        cfg.push(
          `    ${cluster.cidrAddress} dev ${ni.name} label ${cluster.name}`
        );
        cfg.push("  }");
        cfg.push(`  virtual_router_id ${cluster.routerId}`);
        cfg.push(`  priority ${host.priority}`);
        cfg.push("  advert_int 5");
        cfg.push("  authentication {");
        cfg.push("    auth_type PASS");
        cfg.push("    auth_pass pass1234");
        cfg.push("  }");
        cfg.push("}");
        cfg.push("");

        for (const service of cluster.findServices({ type: "http" })) {
          console.log("S",service.host.name,service.name);
          cfg.push(`virtual_server ${cluster.rawAddress} ${service.port} {`);
          cfg.push("  delay_loop 6");
          cfg.push("  lb_algo wlc");
          cfg.push("  persistence_timeout 600");
          cfg.push(`  protocol ${service.protocol.toUpperCase()}`);

          for (const member of this.members) {
            cfg.push(`  real_server ${member.rawAddress} ${service.port} {`);
            cfg.push("    weight 100");

            if (service.protocol === "tcp") {
              cfg.push(`    TCP_CHECK {`);
              cfg.push("      connect_timeout 3");
              cfg.push("    }");
            }

            cfg.push("  }");
          }

          cfg.push("}");
          cfg.push("");
        }
      }

      await writeLines(
        join(packageStagingDir, "etc/keepalived"),
        "keepalived.conf",
        cfg
      );

      (result.outputs = host.outputs), (result.properties.name = name);
      result.properties.dependencies = ["keepalived"];

      result.sources.push(
        new FileContentProvider(packageStagingDir + "/")[Symbol.asyncIterator]()
      );

      yield result;
    }
  }
}
