import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { default_collection_attribute_writable } from "pacc";
import { addType, FAMILY_UNIX, FAMILY_IPV4_IPV6, CoreService } from "pmcf";
import { writeLines } from "../utils.mjs";

export class chrony extends CoreService {
  static attributes = {
    servers: {
      ...default_collection_attribute_writable,
      type: "endpoint",
      name: "servers",
      deferredExpression: true
    },
    peers: {
      ...default_collection_attribute_writable,
      type: "endpoint",
      name: "peers",
      deferredExpression: true
    }
  };

  static service = {
    systemdService: "chronyd.service",
    extends: ["ntp"],
    services: {
      "chrony-cmd": {
        endpoints: [
          {
            family: FAMILY_IPV4_IPV6,
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
    const packageData = await this.packageData;

    packageData.sources.push(
      ...(await Array.fromAsync(this.templateContent()))
    );

    packageData.sources.push(
      new FileContentProvider({
        dir: dir + "/",
        permissions: this.content?.permissions
      })
    );

    const subnets = [...new Map(this.subnets).values()]; // TODO should be normal
    const host = this.host;

    function chronyServer(endpoint) {
      const values = [
        endpoint.isPool ? "pool" : "server",
        endpoint.address,
        "iburst"
      ];

      if (endpoint.isPool) {
        values.push("maxsources 2");
      }
      if (endpoint.priority > 300) {
        values.push("prefer");
      }

      return values.join(" ");
    }

    const lines = [
      this.servers.flat().map(chronyServer),
      this.peers
        .flat()
        .filter(endpoint => !endpoint.service.host.isMember(host))
        .map(chronyServer),
      `mailonchange ${this.administratorEmail} 0.5`,
      "local stratum 10 orphan",
      "leapsectz right/UTC",
      "makestep 1.0 3",
      "ratelimit interval 3 burst 8",
      "driftfile /var/lib/chrony/drift",
      "ntsdumpdir /var/lib/chrony",
      "dumpdir /var/lib/chrony",
      "pidfile /run/chrony/chronyd.pid",
      subnets.map(s => `allow ${s.address}`),
      "cmdratelimit interval -4 burst 16",
      subnets.map(s => `cmdallow ${s.address}`)
    ];

    await writeLines(join(dir, "etc"), "chrony.conf", lines);

    yield packageData;
  }
}
