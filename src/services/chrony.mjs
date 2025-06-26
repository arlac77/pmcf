import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { isLinkLocal } from "ip-utilties";

import { addType } from "../types.mjs";
import {
  Service,
  ServiceTypeDefinition,
  serviceEndpoints
} from "../service.mjs";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition
} from "../extra-source-service.mjs";
import { writeLines } from "../utils.mjs";

const ChronyServiceTypeDefinition = {
  name: "chrony",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  properties: {},
  service: {
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
  }

  static get typeDefinition() {
    return ChronyServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);

    this._extends.push(new Service(owner, { name: this.name, type: "ntp" }));

    this.read(data, ChronyServiceTypeDefinition);

    this._systemd = "chronyd.service";
  }

  get type() {
    return ChronyServiceTypeDefinition.name;
  }

  async *preparePackages(dir) {
    const network = this.network;
    const host = this.host;
    const name = host.name;

    console.log("chrony", host.name, network.name);

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `chrony-${this.location.name}-${host.name}`,
        description: `chrony definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["chrony>=4.6.1"]
      }
    };

    const lines = [
      ...serviceEndpoints(this, {
        services: {
          types: "ntp",
          priority: ">=100"
        },
        endpoints: e =>
          e.type === "ntp" &&
          !isLinkLocal(e.address) &&
          e.service.host !== host &&
          e.networkInterface?.kind !== "loopback",

        select: endpoint => {
          const options = [
            endpoint.isPool ? "pool" : "server",
            endpoint.address,
            "iburst"
          ];
          if (endpoint.isPool) {
            options.push("maxsources 2");
          }
          if (endpoint.priority > 300) {
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
