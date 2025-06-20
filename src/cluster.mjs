import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Owner } from "./owner.mjs";
import { Host } from "./host.mjs";
import { serviceEndpoints } from "pmcf";
import { addType } from "./types.mjs";
import { writeLines } from "./utils.mjs";

const ClusterTypeDefinition = {
  name: "cluster",
  owners: [Owner.typeDefinition, "network", "location", "root"],
  priority: 0.7,
  extends: Host.typeDefinition,
  properties: {
    routerId: { type: "number", collection: false, writeable: true },
    masters: { type: "network_interface", collection: true, writeable: true },
    backups: { type: "network_interface", collection: true, writeable: true },
    members: { type: "network_interface", collection: true, writeable: false },
    checkInterval: { type: "number", collection: false, writeable: true }
  }
};

export class Cluster extends Host {
  _masters = [];
  _backups = [];
  routerId = 100;
  checkInterval = 60;

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
    this._masters.push(value);
    value.cluster = this;
  }

  get masters() {
    return this._masters;
  }

  set backups(value) {
    this._backups.push(value);

    value.cluster = this;
  }

  get backups() {
    return this._backups;
  }

  get members() {
    return new Set(this.masters).union(new Set(this.backups));
  }

  async *preparePackages(stagingDir) {
    for (const ni of [...this.owner.clusters()].reduce(
      (all, cluster) => all.union(cluster.members),
      new Set()
    )) {
      const host = ni.host;
      const name = `keepalived-${host.location.name}-${host.name}`;
      const packageStagingDir = join(stagingDir, name);
      const result = {
        sources: [
          new FileContentProvider(packageStagingDir + "/")[
            Symbol.asyncIterator
          ]()
        ],
        outputs: host.outputs,
        properties: {
          name,
          description: `${this.typeName} definitions for ${this.fullName}`,
          access: "private",
          dependencies: ["keepalived>=2.3.4"]
        }
      };

      const cfg = [
        "global_defs {",
        "   notification_email {",
        "    " + this.administratorEmail,
        "  }",
        `  smtp_server ${this.smtp.address()}`,
        `  notification_email_from keepalived@${host.domainName}`,
        "  enable_script_security",
        "  script_user root",
        "  max_auto_priority 20",
        "}",
        ""
      ];

      for (const cluster of [...this.owner.clusters()].sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        cfg.push(`vrrp_instance ${cluster.name} {`);
        cfg.push(
          `  state ${cluster.masters.indexOf(ni) === 0 ? "MASTER" : "BACKUP"}`
        );
        cfg.push(`  interface ${ni.name}`);

        for (const na of cluster.networkAddresses(
          na => na.networkInterface.kind !== "loopback"
        )) {
          cfg.push(
            `  ${
              na.family === "IPv4"
                ? "virtual_ipaddress"
                : "virtual_ipaddress_excluded"
            } {`
          );
          cfg.push(
            `    ${na.cidrAddress} dev ${ni.name} label ${cluster.name}`
          );
          cfg.push("  }");
        }

        cfg.push(`  virtual_router_id ${cluster.routerId}`);

        let reducedPrio = cluster.masters.indexOf(ni);
        if(reducedPrio < 0) {
          reducedPrio = cluster.backups.indexOf(ni) + 5;
        }

        cfg.push(`  priority ${host.priority - reducedPrio}`);
        cfg.push("  smtp_alert");
        cfg.push("  advert_int 5");
        cfg.push("  authentication {");
        cfg.push("    auth_type PASS");
        cfg.push("    auth_pass pass1234");
        cfg.push("  }");

        cfg.push(
          `  notify_master "/usr/bin/systemctl start ${cluster.name}-master.target"`,
          `  notify_backup "/usr/bin/systemctl start ${cluster.name}-backup.target"`,
          `  notify_fault "/usr/bin/systemctl start ${cluster.name}-fault.target"`
        );

        cfg.push("}", "");

        for (const endpoint of serviceEndpoints(cluster, {
          services: { type: "http" },
          endpoints: e => e.networkInterface.kind !== "loopback"
        })) {
          cfg.push(`virtual_server ${cluster.address} ${endpoint.port} {`);
          cfg.push(`  delay_loop ${cluster.checkInterval}`);
          cfg.push("  lb_algo wlc");
          cfg.push("  persistence_timeout 600");
          cfg.push(`  protocol ${endpoint.protocol.toUpperCase()}`);

          for (const member of this.members) {
            const memberService =
              member.findService({ type: endpoint.type }) ||
              member.host.findService({ type: endpoint.type }); // TODO

            cfg.push(`  real_server ${member.address} ${memberService.port} {`);
            cfg.push(`    weight ${memberService.weight}`);

            switch (endpoint.type) {
              case "dns":
                cfg.push(`    DNS_CHECK {`);
                cfg.push("      type A");
                cfg.push("      name google.com");
                cfg.push("    }");
                break;
              case "smtp":
                cfg.push(`    SMTP_CHECK {`);
                cfg.push("    }");
                break;

              default:
                switch (endpoint.protocol) {
                  case "tcp":
                    cfg.push(`    TCP_CHECK {`);
                    cfg.push("      connect_timeout 10");
                    cfg.push("    }");
                    break;
                }
            }

            cfg.push("  }");
          }

          cfg.push("}", "");
          break; // only one for now
        }
      }

      await writeLines(
        join(packageStagingDir, "etc/keepalived"),
        "keepalived.conf",
        cfg
      );

      await writeLines(
        join(packageStagingDir, "/usr/lib/systemd/system"),
        `${this.name}-master.target`,
        [
          "[Unit]",
          `Description=master state of cluster ${this.name}`,
          "PartOf=keepalived.service",
          `Conflicts=${this.name}-fault.target`
        ]
      );

      await writeLines(
        join(packageStagingDir, "/usr/lib/systemd/system"),
        `${this.name}-backup.target`,
        [
          "[Unit]",
          `Description=backup state of cluster ${this.name}`,
          "PartOf=keepalived.service",
          `Conflicts=${this.name}-fault.target`
        ]
      );

      await writeLines(
        join(packageStagingDir, "/usr/lib/systemd/system"),
        `${this.name}-fault.target`,
        [
          "[Unit]",
          `Description=fault state of cluster ${this.name}`,
          `Conflicts=${this.name}-master.target ${this.name}-backup.target`
        ]
      );

      yield result;
    }
  }
}
