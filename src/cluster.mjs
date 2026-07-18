import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { FAMILY_IPV4 } from "ip-utilties";
import { number_attribute_writable, duration_attribute_writable } from "pacc";
import { Host } from "./host.mjs";
import { addType, serviceEndpoints } from "pmcf";
import {
  networkInterfaces_attribute,
  cluster_attribute
} from "./common-attributes.mjs";
import { writeLines } from "./utils.mjs";

export class Cluster extends Host {
  static name = "cluster";
  static priority = 1.5;
  static attributes = {
    routerId: { ...number_attribute_writable, name: "routerId", default: 100 },
    masters: {
      ...networkInterfaces_attribute,
      name: "masters",
      backpointer: cluster_attribute
    },
    backups: {
      ...networkInterfaces_attribute,
      name: "backups",
      backpointer: cluster_attribute
    },
    members: {
      ...networkInterfaces_attribute,
      name: "members"
    },
    checkInterval: {
      ...duration_attribute_writable,
      name: "checkInterval",
      default: 60
    }
  };

  static {
    addType(this);
  }

  masters = [];
  backups = [];
  routerId = 100;
  checkInterval = 60;

  get members() {
    return new Set(this.masters).union(new Set(this.backups));
  }

  async *preparePackages(stagingDir) {
    for (const ni of [...this.owner.clusters].reduce(
      (all, cluster) => all.union(cluster.members),
      new Set()
    )) {
      const host = ni.host;
      const packageStagingDir = join(stagingDir, host.name);
      const name = `${this.owner.name}-${host.name}`;

      const packageData = host.packageData;
      packageData.sources.push(
        new FileContentProvider(packageStagingDir + "/")
      );
      packageData.properties.name = `keepalived-${name}`;
      packageData.properties.description = `${this.typeName} definitions for ${this.fullName}`;
      packageData.properties.groups.push("config", name, "keepalived");

      const extra = [];

      const smtp = this.smtp;
      if (smtp) {
        extra.push(`  smtp_server ${smtp.address()}`);
      }

      const cfg = [
        "global_defs {",
        "   notification_email {",
        "    " + this.administratorEmail,
        "  }",
        ...extra,
        `  notification_email_from keepalived@${host.domainName}`,
        "  enable_script_security",
        "  script_user root",
        "  max_auto_priority 20",
        "}",
        ""
      ];

      const credentials = [];
      for (const cluster of [...this.owner.clusters].sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        const name = cluster.name;
        cfg.push(`vrrp_instance ${name} {`);
        cfg.push(
          `  state ${cluster.masters.indexOf(ni) === 0 ? "MASTER" : "BACKUP"}`
        );
        cfg.push(`  interface ${ni.name}`);

        for (const na of cluster.networkAddresses(
          na => na.networkInterface.kind !== "loopback"
        )) {
          cfg.push(
            `  ${
              na.family === FAMILY_IPV4
                ? "virtual_ipaddress"
                : "virtual_ipaddress_excluded"
            } {`
          );
          cfg.push(
            `    ${na.cidrAddress} dev ${ni.name} label ${name}`
          );
          cfg.push("  }");
        }

        cfg.push(`  virtual_router_id ${cluster.routerId}`);

        let reducedPrio = cluster.masters.indexOf(ni);
        if (reducedPrio < 0) {
          reducedPrio = cluster.backups.indexOf(ni) + 5;
        }

        const credential = name.toUpperCase() + "_PASSWORD";
        credentials.push(credential);
        cfg.push(`  priority ${host.priority - reducedPrio}`);
        cfg.push("  smtp_alert");
        cfg.push("  advert_int 5");
        cfg.push("  authentication {");
        cfg.push("    auth_type PASS");
        cfg.push("    auth_pass ${" + credential + "}");
        cfg.push("  }");

        cfg.push(
          `  notify_master "/usr/bin/systemctl start ${name}-master.target"`,
          `  notify_backup "/usr/bin/systemctl start ${name}-backup.target"`,
          `  notify_fault "/usr/bin/systemctl start ${name}-fault.target"`
        );

        cfg.push("}", "");

        for (const endpoint of serviceEndpoints(cluster, {
          services: "services[types[http]]",
          endpoints: e =>
            e.networkInterface && e.networkInterface.kind !== "loopback"
        })) {
          cfg.push(`virtual_server ${cluster.address} ${endpoint.port} {`);
          cfg.push(`  delay_loop ${cluster.checkInterval}`);
          cfg.push("  lb_algo wlc");
          cfg.push("  persistence_timeout 600");
          cfg.push(`  protocol ${endpoint.protocol.toUpperCase()}`);

          for (const member of this.members) {
            const memberService = Array.from(
              member.expression(`services[types[${endpoint.type}]][0]`)
            );

            console.log(member.fullName, endpoint.type, memberService);
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
        await writeLines(
          join(packageStagingDir, "/usr/lib/systemd/system"),
          `${name}-master.target`,
          [
            "[Unit]",
            `Description=master state of cluster ${name}`,
            "PartOf=keepalived.service",
            `Conflicts=${name}-backup.target ${name}-fault.target`
          ]
        );

        await writeLines(
          join(packageStagingDir, "/usr/lib/systemd/system"),
          `${name}-backup.target`,
          [
            "[Unit]",
            `Description=backup state of cluster ${name}`,
            "PartOf=keepalived.service",
            `Conflicts=${name}-master.target ${name}-fault.target`
          ]
        );

        await writeLines(
          join(packageStagingDir, "/usr/lib/systemd/system"),
          `${name}-fault.target`,
          [
            "[Unit]",
            `Description=fault state of cluster ${name}`,
            `Conflicts=${name}-master.target ${name}-backup.target`
          ]
        );

        await writeLines(
          join(packageStagingDir, "/usr/lib/systemd/system/keepalived.d"),
          "credentials.conf",
          [
            "[Service]",
            ...credentials.map(
              c =>
                `LoadCredentialEncrypted=${c}:/etc/credstore.encrypted/keepalived.password`
            )
          ]
        );
      }

      await writeLines(
        join(packageStagingDir, "etc/keepalived"),
        "keepalived.conf",
        cfg
      );

      yield packageData;
    }
  }
}
