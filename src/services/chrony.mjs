import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { isLinkLocal } from "ip-utilties";
import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, serviceEndpoints } from "../service.mjs";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition
} from "../extra-source-service.mjs";
import { writeLines } from "../utils.mjs";

const ChronyServiceTypeDefinition = {
  name: "chrony",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  service: {
    systemdService: "chronyd.service",
    extends: ["ntp"],
    services: {
      "chrony-cmd": {
        endpoints: [
          {
            family: "IPv4",
            port: 323,
            protocol: "tcp",
            tls: false
          },
          {
            family: "IPv6",
            port: 323,
            protocol: "tcp",
            tls: false
          },
          {
            family: "unix",
            path: "/var/run/chrony/chronyd.sock"
          }
        ]
      }
    }
  }
};

export class ChronyService extends ExtraSourceService {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return ChronyServiceTypeDefinition;
  }

  get type() {
    return ChronyServiceTypeDefinition.name;
  }

  async *preparePackages(dir) {
    const packageData = this.packageData;
    packageData.sources.push(new FileContentProvider(dir + "/"));

    const host = this.host;

    const lines = [
      ...serviceEndpoints(this, {
        services: 'types[ntp] && priority>=100',
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
          if (endpoint.priority > 300 && endpoint.family === "IPv4") {
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
      [...this.subnets].map(s => `allow ${s.address}`),
      "cmdratelimit interval -4 burst 16",
      [...this.subnets].map(s => `cmdallow ${s.address}`)
    ];

    await writeLines(join(dir, "etc"), "chrony.conf", lines);

    yield packageData;
  }
}
