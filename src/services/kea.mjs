import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { reverseArpa } from "ip-utilties";
import {
  Service,
  sortInverseByPriority,
  ServiceTypeDefinition,
  Endpoint,
  UnixEndpoint,
  HTTPEndpoint,
  serviceEndpoints,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6
} from "pmcf";
import { addType } from "../types.mjs";
import { writeLines } from "../utils.mjs";

const KeaServiceTypeDefinition = {
  name: "kea",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {}
};

const ddnsEndpoint = {
  type: "kea-ddns",
  port: 53001,
  protocol: "tcp",
  tls: false
};

const controlAgentEndpoint = {
  type: "kea-control-agent",
  port: 53002,
  pathname: "/",
  protocol: "tcp",
  tls: false
};

const ha4Endpoint = {
  type: "kea-ha-4",
  port: 53003,
  pathname: "/",
  protocol: "tcp",
  tls: false
};

const ha6Endpoint = {
  type: "kea-ha-6",
  port: 53004,
  pathname: "/",
  protocol: "tcp",
  tls: false
};

const control4Endpoint = {
  type: "kea-control-dhcp4",
  family: "unix",
  path: "/run/kea/4-ctrl-socket"
};

const control6Endpoint = {
  type: "kea-control-dhcp6",
  family: "unix",
  path: "/run/kea/6-ctrl-socket"
};

const controlDDNSEndpoint = {
  type: "kea-control-ddns",
  family: "unix",
  path: "/run/kea/ddns-ctrl-socket"
};

const keaVersion = 2.6;
export const fetureHasHTTPEndpoints = keaVersion > 2.7;

export class KeaService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return KeaServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, KeaServiceTypeDefinition);
  }

  get type() {
    return "dhcp"; //KeaServiceTypeDefinition.name;
  }

  endpoints(filter) {
    const endpoints = super.endpoints(filter);

    for (const na of this.host.networkAddresses()) {
      endpoints.push(new HTTPEndpoint(this, na, controlAgentEndpoint));

      if (fetureHasHTTPEndpoints) {
        endpoints.push(
          new HTTPEndpoint(
            this,
            na,
            na.family === "IPv4" ? ha4Endpoint : ha6Endpoint
          )
        );
      }

      if (na.networkInterface.kind === "loopback") {
        endpoints.push(new Endpoint(this, na, ddnsEndpoint));
      }
    }

    endpoints.push(
      new UnixEndpoint(this, control4Endpoint.path, control4Endpoint),
      new UnixEndpoint(this, control6Endpoint.path, control6Endpoint),
      new UnixEndpoint(this, controlDDNSEndpoint.path, controlDDNSEndpoint)
    );

    return filter ? endpoints.filter(filter) : endpoints;
  }

  async *preparePackages(dir) {
    const network = this.network;
    const host = this.host;
    const name = host.name;

    console.log("kea", name, network.name);

    const dnsServerEndpoints = serviceEndpoints(network, {
      services: {
        type: "dns",
        priority: "<10"
      },
      endpoints: endpoint => endpoint.networkInterface.kind !== "loopback"
    });

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `kea-${this.location.name}-${name}`,
        description: `kea definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: [`kea>=${keaVersion}`]
      }
    };

    const ctrlAgentEndpoint = this.endpoint(
      e => e.type === "kea-control-agent"
    );

    const peers = async family =>
      (
        await Array.fromAsync(
          network.findServices({ type: "dhcp", priority: "<20" })
        )
      )
        .sort(sortInverseByPriority)
        .map((dhcp, i) => {
          const ctrlAgentEndpoint = dhcp.endpoint(
            e =>
              e.type ===
              (fetureHasHTTPEndpoints
                ? `kea-ha-${family}`
                : "kea-control-agent")
          );

          if (ctrlAgentEndpoint) {
            return {
              name: dhcp.host.name,
              role: i === 0 ? "primary" : i > 1 ? "backup" : "standby",
              url: ctrlAgentEndpoint.url,
              "auto-failover": i <= 1
            };
          }
        }).filter(p=>p!= null);

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

    const commonConfig = async family => {
      return {
        "interfaces-config": {
          interfaces: listenInterfaces(`IPv${family}`)
        },
        "control-socket": toUnix(
          this.endpoint(e => e.type === `kea-control-dhcp${family}`)
        ),
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
        "valid-lifetime": 86400,
        "hooks-libraries": [
          /*{
            library: "/usr/lib/kea/hooks/libdhcp_ddns_tuning.so"
          },*/
          {
            library: "/usr/lib/kea/hooks/libdhcp_lease_cmds.so"
          },
          {
            library: "/usr/lib/kea/hooks/libdhcp_ha.so",
            parameters: {
              "high-availability": [
                {
                  "this-server-name": name,
                  mode: "hot-standby",
                  "heartbeat-delay": 60000,
                  "max-response-delay": 60000,
                  "max-ack-delay": 10000,
                  /*
                  "multi-threading": {
                    "enable-multi-threading": true,
                    "http-dedicated-listener": true,
                    "http-listener-threads": 2,
                    "http-client-threads": 2
                  },*/
                  peers: await peers(family)
                }
              ]
            }
          }
        ],
        "dhcp-ddns": dhcpServerDdns,
        loggers,
        "option-data": [
          {
            name: "domain-name-servers",
            data: dnsServerEndpoints
              .filter(endpoint => endpoint.family === `IPv${family}`)
              .map(endpoint => endpoint.address)
              .join(",")
          },
          {
            name: "domain-search",
            data: [...this.domains].join(",")
          }
        ]
      };
    };

    const toUnix = endpoint => {
      return {
        "socket-type": "unix",
        "socket-name": endpoint?.path
      };
    };

    const ctrlAgent = {
      "Control-agent": {
        "http-host": ctrlAgentEndpoint.hostname,
        "http-port": ctrlAgentEndpoint.port,
        "control-sockets": {
          dhcp4: toUnix(this.endpoint(e => e.type === "kea-control-dhcp4")),
          dhcp6: toUnix(this.endpoint(e => e.type === "kea-control-dhcp6")),
          d2: toUnix(this.endpoint(e => e.type === "kea-control-ddns"))
        },
        loggers
      }
    };

    const dnsServersSlot = names =>
      names.map(name => {
        return {
          name,
          "dns-servers": dnsServerEndpoints
            .filter(endpoint => endpoint.family === "IPv4")
            .map(endpoint => {
              return { "ip-address": endpoint.address };
            })
        };
      });

    const ddnsEndpoint = this.endpoint(e => e.type === "kea-ddns");

    const subnetPrefixes = new Set(
      [...this.subnets]
        .filter(s => s != SUBNET_LOCALHOST_IPV4 && s != SUBNET_LOCALHOST_IPV6)
        .map(s => s.prefix)
    );

    const ddns = {
      DhcpDdns: {
        "ip-address": ddnsEndpoint.address,
        port: ddnsEndpoint.port,
        "control-socket": toUnix(
          this.endpoint(e => e.type === "kea-control-ddns")
        ),
        "tsig-keys": [],
        "forward-ddns": {
          "ddns-domains": dnsServersSlot([...this.domains])
        },
        "reverse-ddns": {
          "ddns-domains": dnsServersSlot(
            [...subnetPrefixes].map(prefix => reverseArpa(prefix))
          )
        },

        loggers
      }
    };

    const dhcpServerDdns = {
      "enable-updates": true,
      "server-ip": ddnsEndpoint.address,
      "server-port": ddnsEndpoint.port,
      "max-queue-size": 64,
      "ncr-protocol": "UDP",
      "ncr-format": "JSON"
    };

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
          hostname: networkInterface.domainName,
          "client-classes": ["SKIP_DDNS"]
        };
      })
      .sort((a, b) => a.hostname.localeCompare(b.hostname));

    const listenInterfaces = family =>
      this.endpoints(
        endpoint =>
          endpoint.type === "dhcp" &&
          endpoint.family === family &&
          endpoint.networkInterface.kind !== "loopback" &&
          endpoint.networkInterface.kind !== "wlan"
      ).map(
        endpoint => `${endpoint.networkInterface.name}/${endpoint.address}`
      );

    const subnets = [...this.subnets].filter(
      s => s !== SUBNET_LOCALHOST_IPV4 && s !== SUBNET_LOCALHOST_IPV6
    );
    const dhcp4 = {
      Dhcp4: {
        ...(await commonConfig("4")),
        subnet4: subnets
          .filter(s => s.family === "IPv4")
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: subnet.dhcpPools.map(range => {
                return { pool: range.join(" - ") };
              }),
              "option-data": [
                {
                  name: "routers",
                  data: network.gateway.address
                }
              ],
              reservations
            };
          })
      }
    };
    const dhcp6 = {
      Dhcp6: {
        ...(await commonConfig("6")),
        subnet6: subnets
          .filter(s => s.family === "IPv6")
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: subnet.dhcpPools.map(range => {
                return { pool: range.join(" - ") };
              }),

              /*"pd-pools": [
                {
                  prefix: "2001:db8:8::",
                  "prefix-len": 56,
                  "delegated-len": 64
                }
              ],*/
              reservations: [
                /*{
                  duid: "01:02:03:04:05:0A:0B:0C:0D:0E",
                  "ip-addresses": ["2001:db8:1::100"]
                }*/
              ]
            };
          })
      }
    };

    for (const [name, data] of Object.entries({
      "kea-ctrl-agent": ctrlAgent,
      "kea-dhcp-ddns": ddns,
      "kea-dhcp4": dhcp4,
      "kea-dhcp6": dhcp6
    })) {
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
