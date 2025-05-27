import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { addType } from "../types.mjs";
import { ServiceTypeDefinition, serviceEndpoints } from "../service.mjs";
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
  properties: {}
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
    this.read(data, ChronyServiceTypeDefinition);
  }

  get type() {
    return "ntp"; //ChronyServiceTypeDefinition.name;
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
          type: "ntp",
          priority: ">=200"
        },
        endpoints: e =>
          e.service.host !== host &&
          //e.family === "IPv4" &&
          e.networkInterface.kind !== "loopback",

        select: endpoint =>
          `${endpoint.isPool ? "pool" : "server"} ${endpoint.domainName} iburst`,

        limit: 7
      }),
      `mailonchange ${this.administratorEmail} 0.5`,
      "local stratum 10",
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
      //this.endpoints(e=>e.type === "ntp" && e.networkInterface.kind=='loopback').map(endpoint=>`alllow ${endpoint.address}`)
    ];

    await writeLines(join(dir, "etc"), "chrony.conf", lines);

    yield packageData;
  }
}
