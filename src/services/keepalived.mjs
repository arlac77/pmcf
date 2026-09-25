import { join } from "node:path";
import {
  default_attribute_writable,
  default_collection_attribute_writable,
  enum_string_attribute_writable,
  priority_attribute_writable
} from "pacc";
import { FAMILY_IPV4 } from "ip-utilties";
import { addType } from "../type.mjs";
import { PROTOCOL_TCP } from "../constants.mjs";
import { core } from "../core.mjs";
import { credential } from "../credential.mjs";
import { CoreService, serviceEndpoints } from "../core-service.mjs";

import { writeLines } from "../utils.mjs";

const ROLE_PRIORITIES = {
  master: 0,
  backup: -20
};

export class keepalive_cluster_member extends core {
  static attributes = {
    cluster: {
      ...default_attribute_writable,
      type: "cluster",
      name: "cluster"
    },
    role: {
      ...enum_string_attribute_writable,
      name: "role",
      values: new Set(Object.keys(ROLE_PRIORITIES))
    },
    priority: priority_attribute_writable
  };
  static key = "cluster";
  static {
    addType(this);
  }

  get fullName() {
    return this.cluster?.fullName;
  }

  set cluster(value) {
    this._cluster = value;
    value.members.add(this);
  }

  get cluster() {
    return this._cluster;
  }

  get host() {
    return this.owner.host;
  }

  get address() {
    return this.owner.owner.address;
  }

  get priority() {
    return;
  }

  /**
   * @return {number}
   */
  get priority() {
    return this._priority ?? this.owner.priority + ROLE_PRIORITIES[this.role];
  }
}

export class keepalived extends CoreService {
  static priority = 1.5;
  static attributes = {
    clusters: {
      ...default_collection_attribute_writable,
      type: keepalive_cluster_member,
      name: "clusters"
    }
  };

  static {
    addType(this);
  }

  clusters = new Set();

  async *preparePackages(dir) {
    const packageData = await this.preparePackage(dir);

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
      `  notification_email_from keepalived@${this.domainName}`,
      "  enable_script_security",
      "  script_user root",
      "  max_auto_priority 20",
      "}",
      ""
    ];

    for (const clusterMember of this.clusters.values()) {
      const cluster = clusterMember.cluster;
      const clusterName = cluster.name;

      cfg.push(`vrrp_instance ${clusterName} {`);
      cfg.push(`  state ${clusterMember.role.toUpperCase()}`);

      const ni = clusterMember.owner.owner;

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
        cfg.push(`    ${na.cidrAddress} dev ${ni.name} label ${clusterName}`);
        cfg.push("  }");
      }

      cfg.push(`  virtual_router_id ${cluster.id}`);

      const cred = new credential(this);
      cred.name = `keepalived.${clusterName}.password`;
      cred.localName = clusterName.toUpperCase() + "_PASSWORD";
      cred._tags.add("keepalived.service");
      this.credentials.set(cred.name, cred);

      cfg.push(`  priority ${clusterMember.priority}`);
      cfg.push("  smtp_alert");
      cfg.push("  advert_int 5");
      cfg.push("  authentication {");
      cfg.push("    auth_type PASS");
      cfg.push("    auth_pass pass1234");
      cfg.push(
        `    # auth_pass file:\${_ENV CREDENTIALS_DIRECTORY}/keepalived.${cluster.name}.password`
      );
      cfg.push("    # auth_pass ${_ENV " + cred.localName + "}");
      cfg.push("    # auth_pass ${" + cred.localName + "}");
      cfg.push("  }");

      cfg.push(
        `  notify_master "/usr/bin/systemctl start ${clusterName}-master.target"`,
        `  notify_backup "/usr/bin/systemctl start ${clusterName}-backup.target"`,
        `  notify_fault "/usr/bin/systemctl start ${clusterName}-fault.target"`
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

        for (const member of cluster.members) {
          const memberService = member.host.expression(
            `services[types[${endpoint.type}]][0]`
          );

          //console.log(member.fullName, endpoint.type, memberService?.fullName);
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
                case PROTOCOL_TCP:
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
        join(dir, "/usr/lib/systemd/system"),
        `${clusterName}-master.target`,
        [
          "[Unit]",
          `Description=master state of cluster ${clusterName}`,
          "PartOf=keepalived.service",
          `Conflicts=${clusterName}-backup.target ${clusterName}-fault.target`
        ]
      );

      await writeLines(
        join(dir, "/usr/lib/systemd/system"),
        `${clusterName}-backup.target`,
        [
          "[Unit]",
          `Description=backup state of cluster ${clusterName}`,
          "PartOf=keepalived.service",
          `Conflicts=${clusterName}-master.target ${clusterName}-fault.target`
        ]
      );

      await writeLines(
        join(dir, "/usr/lib/systemd/system"),
        `${clusterName}-fault.target`,
        [
          "[Unit]",
          `Description=fault state of cluster ${clusterName}`,
          `Conflicts=${clusterName}-master.target ${clusterName}-backup.target`
        ]
      );

      await this.writeSystemdCredentialConfig(dir, "keepalived.service");

      await writeLines(join(dir, "etc/keepalived"), "keepalived.conf", cfg);
    }

    yield packageData;
  }
}
