import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import {
  Service,
  ServiceTypeDefinition,
  Endpoint,
  serviceEndpoints
} from "pmcf";
import { addType } from "../types.mjs";
import { writeLines } from "../utils.mjs";

const DHCPServiceTypeDefinition = {
  name: "dhcp",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

const controlAgentEndpoint = {
  type: "kea-control-agent",
  port: 8000,
  protocol: "tcp",
  tls: false
};

const ddnsEndpoint = {
  type: "kea-ddns",
  port: 53001,
  protocol: "tcp",
  tls: false
};

export class DHCPService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return DHCPServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, DHCPServiceTypeDefinition);
  }

  get type() {
    return DHCPServiceTypeDefinition.name;
  }

  endpoints(filter) {
    const endpoints = super.endpoints(filter);

    for (const na of this.host.networkAddresses(
      na => na.networkInterface.kind === "localhost"
    )) {
      endpoints.push(new Endpoint(this, na, controlAgentEndpoint));
      endpoints.push(new Endpoint(this, na, ddnsEndpoint));
    }

    return endpoints;
  }

  async *preparePackages(dir) {
    const network = this.network;
    const host = this.host;
    const name = host.name;

    console.log("kea", host.name, network.name);

    const dnsServerEndpoints = serviceEndpoints(
      network,
      {
        type: "dns",
        priority: "<10"
      },
      endpoint => endpoint.networkInterface.kind !== "loopback"
    );

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `kea-${this.location.name}-${host.name}`,
        description: `kea definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["kea>=2.6.1"]
      }
    };

    const commonConfig = {
      "lease-database": {
        type: "memfile",
        "lfc-interval": 3600
      },
      "multi-threading": {
        "enable-multi-threading": false
      },
      "expired-leases-processing": {
        "reclaim-timer-wait-time": 10,
        "flush-reclaimed-timer-wait-time": 25,
        "hold-reclaimed-time": 3600,
        "max-reclaim-leases": 100,
        "max-reclaim-time": 250,
        "unwarned-reclaim-cycles": 5
      },
      "renew-timer": 900,
      "rebind-timer": 1800,
      "valid-lifetime": 3600
    };

    const loggers = [
      {
        "output-options": [
          {
            output: "syslog"
          }
        ],
        severity: "INFO",
        debuglevel: 0
      }
    ];

    const ctrlAgent = {
      "Control-agent": {
        "http-host": "127.0.0.1",
        "http-port": 8000,
        "control-sockets": {
          dhcp4: {
            "socket-type": "unix",
            "socket-name": "/run/kea/4-ctrl-socket"
          },
          dhcp6: {
            "socket-type": "unix",
            "socket-name": "/run/kea/6-ctrl-socket"
          },
          d2: {
            "socket-type": "unix",
            "socket-name": "/run/kea/ddns-ctrl-socket"
          }
        },
        loggers
      }
    };

    const dnsServersSlot = domains =>
      domains.map(domain => {
        return {
          name: domain,
          "dns-servers": dnsServerEndpoints
            .filter(endpoint => endpoint.family === "IPv4")
            .map(endpoint => {
              return { "ip-address": endpoint.address };
            })
        };
      });

    const ddns = {
      DhcpDdns: {
        "ip-address": "127.0.0.1",
        port: 53001,
        "control-socket": {
          "socket-type": "unix",
          "socket-name": "/run/kea/ddns-ctrl-socket"
        },
        "tsig-keys": [],
        "forward-ddns": {
          "ddns-domains": dnsServersSlot([...this.domains])
        },
        /*
        "reverse-ddns": {
          "ddns-domains": dnsSlot()
        },
        */
        loggers
      }
    };

    const dhcpServerDdns = {
      "enable-updates": true,
      "server-ip": "127.0.0.1",
      "server-port": ddns.DhcpDdns.port,
      "max-queue-size": 64,
      "ncr-protocol": "UDP",
      "ncr-format": "JSON"
    };

    const subnets = new Set();

    for (const network of this.networks) {
      for (const subnet of network.subnets()) {
        subnets.add(subnet);
      }
    }

    const hwmap = new Map();
    const hostNames = new Set();

    for await (const { networkInterface } of network.networkAddresses()) {
      if (networkInterface.hwaddr) {
        if (!hostNames.has(networkInterface.hostName)) {
          hwmap.set(networkInterface.hwaddr, networkInterface);
          hostNames.add(networkInterface.hostName);
        }
      }
    }

    const reservations = [...hwmap]
      .map(([k, networkInterface]) => {
        return {
          "hw-address": k,
          "ip-address": networkInterface.networkAddress(
            n => n.family === "IPv4"
          ).address,
          hostname: networkInterface.hostName
        };
      })
      .sort((a, b) => a.hostname.localeCompare(b.hostname));

    const listenInterfaces = family =>
      this.endpoints(
        endpoint =>
          endpoint.type === "dhcp" &&
          endpoint.family === family &&
          endpoint.networkInterface.kind !== "loopback"
      ).map(
        endpoint => `${endpoint.networkInterface.name}/${endpoint.address}`
      );

    const dhcp4 = {
      Dhcp4: {
        ...commonConfig,
        "interfaces-config": {
          interfaces: listenInterfaces("IPv4")
        },
        "control-socket": {
          "socket-type": "unix",
          "socket-name": "/run/kea/4-ctrl-socket"
        },
        "option-data": [
          {
            name: "domain-name-servers",
            data: dnsServerEndpoints
              .filter(endpoint => endpoint.family === "IPv4")
              .map(endpoint => endpoint.address)
              .join(",")
          },
          {
            name: "domain-search",
            data: [...this.domains].join(",")
          }
        ],
        subnet4: [...subnets]
          .filter(s => s.family === "IPv4")
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: [{ pool: subnet.addressRange.join(" - ") }],
              "option-data": [
                {
                  name: "routers",
                  data: network.gateway.address
                }
              ],
              reservations
            };
          }),
        "dhcp-ddns": dhcpServerDdns,
        loggers
      }
    };
    const dhcp6 = {
      Dhcp6: {
        ...commonConfig,
        "interfaces-config": {
          interfaces: listenInterfaces("IPv6")
        },
        "control-socket": {
          "socket-type": "unix",
          "socket-name": "/run/kea/6-ctrl-socket"
        },
        "preferred-lifetime": 3000,
        "option-data": [
          {
            name: "dns-servers",
            data: dnsServerEndpoints
              .filter(endpoint => endpoint.family === "IPv6")
              .map(endpoint => endpoint.address)
              .join(",")
          }
        ],
        subnet6: [...subnets]
          .filter(s => s.family === "IPv6")
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: [{ pool: subnet.addressRange.join(" - ") }],

              "pd-pools": [
                {
                  prefix: "2001:db8:8::",
                  "prefix-len": 56,
                  "delegated-len": 64
                }
              ],
              reservations: [
                {
                  duid: "01:02:03:04:05:0A:0B:0C:0D:0E",
                  "ip-addresses": ["2001:db8:1::100"]
                }
              ]
            };
          }),
        "dhcp-ddns": dhcpServerDdns,
        loggers
      }
    };

    const files = {
      "kea-ctrl-agent": ctrlAgent,
      "kea-dhcp-ddns": ddns,
      "kea-dhcp4": dhcp4,
      "kea-dhcp6": dhcp6
    };

    for (const [name, data] of Object.entries(files)) {
      loggers[0].name = name;
      await writeLines(
        join(packageData.dir, "etc/kea"),
        `${name}.conf`,
        JSON.stringify(data, undefined, 2)
      );
    }

    yield packageData;
  }
}
