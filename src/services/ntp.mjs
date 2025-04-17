import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { addType } from "../types.mjs";
import { ServiceTypeDefinition, serviceEndpoints } from "../service.mjs";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition
} from "../extra-source-service.mjs";
import { writeLines } from "../utils.mjs";

const NTPServiceTypeDefinition = {
  name: "ntp",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ExtraSourceServiceTypeDefinition,
  priority: 0.1,
  properties: {
    isPool: {
      type: "boolean",
      collection: false,
      writeable: true,
      default: false
    }
  }
};

const NTP_SERVICE_FILTER = { type: NTPServiceTypeDefinition.name };

export class NTPService extends ExtraSourceService {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return NTPServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NTPServiceTypeDefinition);
  }

  get type() {
    return NTPServiceTypeDefinition.name;
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
          ...NTP_SERVICE_FILTER,
          priority: ">=10"
        },
        endpoints: e =>
          e.family === "IPv4" && e.networkInterface.kind !== "loopback",

        select: endpoint =>
          `${endpoint.service.isPool ? "pool" : "server"} ${
            endpoint.address
          } iburst`
      }),
      `mailonchange ${this.administratorEmail} 0.5`,
      "local stratum 10",
      "leapsectz right/UTC",
      "makestep 1.0 3",
      "ratelimit interval 3 burst 8",
      "cmdratelimit interval -4 burst 16",
      "driftfile /var/lib/chrony/drift",
      "ntsdumpdir /var/lib/chrony",
      "dumpdir /var/lib/chrony",
      "pidfile /run/chrony/chronyd.pid"
    ];

    await writeLines(join(dir, "etc"), "chrony.conf", lines);

    yield packageData;
  }
}
