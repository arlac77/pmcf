import { join } from "node:path";
import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import { FileContentProvider } from "npm-pkgbuild";
import { isLinkLocal } from "ip-utilties";
import { serviceEndpoints, addType, ExtraSourceService, FAMILY_UNIX } from "pmcf";
import { writeLines } from "../utils.mjs";

export class chrony extends ExtraSourceService {
  static service = {
    systemdService: "chronyd.service",
    extends: ["ntp"],
    services: {
      "chrony-cmd": {
        endpoints: [
          {
            family: FAMILY_IPV4,
            port: 323,
            protocol: "tcp",
            tls: false
          },
          {
            family: FAMILY_IPV6,
            port: 323,
            protocol: "tcp",
            tls: false
          },
          {
            family: FAMILY_UNIX,
            path: "/var/run/chrony/chronyd.sock"
          }
        ]
      }
    }
  };

  static {
    addType(this);
  }

  async *preparePackages(dir) {
    const packageData = this.packageData;
    packageData.sources.push(new FileContentProvider(dir + "/"));

    const host = this.host;

    const lines = [
      ...serviceEndpoints(this, {
        services: "services[types[ntp] && priority>=100]",
        endpoints: e =>
          e.type === "ntp" &&
          !isLinkLocal(e.address) &&
          e.service.host !== host &&
          e.networkInterface &&
          e.networkInterface.kind !== "loopback",
        select: endpoint => {
          const options = [
            endpoint.isPool ? "pool" : "server",
            endpoint.address,
            "iburst"
          ];
          if (endpoint.isPool) {
            options.push("maxsources 2");
          }
          if (endpoint.priority > 300 && endpoint.family === FAMILY_IPV4) {
            options.push("prefer");
          }
          return options.join(" ");
        }
      }),
      `mailonchange ${this.administratorEmail} 0.5`,
      "local stratum 10 orphan",
      "leapsectz right/UTC",
      "makestep 1.0 3",
      "ratelimit interval 3 burst 8",
      "driftfile /var/lib/chrony/drift",
      "ntsdumpdir /var/lib/chrony",
      "dumpdir /var/lib/chrony",
      "pidfile /run/chrony/chronyd.pid",
      [...this.subnets.values()].map(s => `allow ${s.address}`),
      "cmdratelimit interval -4 burst 16",
      [...this.subnets.values()].map(s => `cmdallow ${s.address}`)
    ];

    await writeLines(join(dir, "etc"), "chrony.conf", lines);

    yield packageData;
  }
}
