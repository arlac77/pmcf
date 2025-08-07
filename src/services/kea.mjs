import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { reverseArpa } from "ip-utilties";
import {
  string_attribute,
  number_attribute_writable,
  boolean_attribute_writable_true
} from "pacc";
import {
  Service,
  sortDescendingByPriority,
  ServiceTypeDefinition,
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
  properties: {
    "ddns-send-updates": {
      ...boolean_attribute_writable_true,
      isCommonOption: true
    },
    "renew-timer": {
      ...number_attribute_writable,
      isCommonOption: true,
      default: 900
    },
    "rebind-timer": {
      ...number_attribute_writable,
      isCommonOption: true,
      default: 1800
    },
    "valid-lifetime": {
      ...number_attribute_writable,
      mandatory: true,
      isCommonOption: true,
      default: 86400
    },
    "ddns-conflict-resolution-mode": {
      ...string_attribute,
      writable: true,
      isCommonOption: true
      //values: ["check-exists-with-dhcid"]
    }
  },
  service: {
    extends: ["dhcp"],
    services: {
      "kea-ddns": {
        endpoints: [
          {
            family: "IPv4",
            kind: "loopback",
            port: 53001,
            protocol: "tcp",
            tls: false
          }
        ]
      },
      /*"kea-control-agent": {
        endpoints: [
          {
            family: "IPv4",
            port: 53002,
            pathname: "/",
            protocol: "tcp",
            tls: false
          }
        ]
      },*/
      "kea-ha-4": {
        endpoints: [
          {
            family: "IPv4",
            port: 53003,
            pathname: "/",
            protocol: "tcp",
            tls: false
          }
        ]
      },
      "kea-ha-6": {
        endpoints: [
          {
            family: "IPv6",
            port: 53004,
            pathname: "/",
            protocol: "tcp",
            tls: false
          }
        ]
      },
      "kea-control-dhcp4": {
        endpoints: [
          {
            family: "unix",
            path: "/run/kea/ctrl-4"
          }
        ]
      },
      "kea-control-dhcp6": {
        endpoints: [
          {
            family: "unix",
            path: "/run/kea/ctrl-6"
          }
        ]
      },
      "kea-control-ddns": {
        endpoints: [
          {
            family: "unix",
            path: "/run/kea/ctrl-ddns"
          }
        ]
      }
    }
  }
};

const keaVersion = 3.0;
export const fetureHasHTTPEndpoints = keaVersion >= 3.0;

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
    return KeaServiceTypeDefinition.name;
  }

  async *preparePackages(dir) {
    const ctrlAgentEndpoint = this.endpoint(
      fetureHasHTTPEndpoints ? "kea-ha-4" : "kea-control-agent"
    );

    if (!ctrlAgentEndpoint) {
      return;
    }

    const network = this.network;
    const host = this.host;
    const name = host.name;

    console.log("kea", name, network.name);

    const dnsServerEndpoints = serviceEndpoints(network, {
      services: {
        types: "dns",
        priority: ">=300"
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

    const peers = async family =>
      (
        await Array.fromAsync(
          network.findServices({
            type: "kea",
            priority: ">=" + (this.priority < 100 ? this.priority : 100)
          })
        )
      )
        .sort(sortDescendingByPriority)
        .map((dhcp, i) => {
          const ctrlAgentEndpoint = dhcp.endpoint(
            fetureHasHTTPEndpoints ? `kea-ha-${family}` : "kea-control-agent"
          );

          if (ctrlAgentEndpoint) {
            return {
              name: dhcp.host.name,
              role: i === 0 ? "primary" : i > 1 ? "backup" : "standby",
              url: ctrlAgentEndpoint.url,
              "auto-failover": i <= 1
            };
          }
        })
        .filter(p => p != null);

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
      const cfg = {
        "interfaces-config": {
          interfaces: listenInterfaces(`IPv${family}`)
        },
        "control-sockets": [toUnix(this.endpoint(`kea-control-dhcp${family}`))],
        "lease-database": {
          type: "memfile",
          "lfc-interval": 3600
        },
        "multi-threading": {
          "enable-multi-threading": true,
          "thread-pool-size": 2,
          "packet-queue-size": 4
        },
        "expired-leases-processing": {
          "reclaim-timer-wait-time": 10,
          "flush-reclaimed-timer-wait-time": 25,
          "hold-reclaimed-time": 3600,
          "max-reclaim-leases": 100,
          "max-reclaim-time": 250,
          "unwarned-reclaim-cycles": 5
        },
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
            name: family == 4 ? "domain-name-servers" : "dns-servers",
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

      for (const [key] of Object.entries(
        KeaServiceTypeDefinition.properties
      ).filter(
        ([key, attribute]) =>
          attribute.isCommonOption && this[key] !== undefined
      )) {
        cfg[key] = this[key];
      }

      return cfg;
    };

    const toUnix = endpoint => {
      return {
        "socket-type": "unix",
        "socket-name": endpoint?.path
      };
    };

    /*const ctrlAgent = {
      "Control-agent": {
        "http-host": ctrlAgentEndpoint.hostname,
        "http-port": ctrlAgentEndpoint.port,
        "control-sockets": {
          dhcp4: toUnix(this.endpoint("kea-control-dhcp4")),
          dhcp6: toUnix(this.endpoint("kea-control-dhcp6")),
          d2: toUnix(this.endpoint("kea-control-ddns"))
        },
        loggers
      }
    };*/

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

    const ddnsEndpoint = this.endpoint("kea-ddns");

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
      "max-queue-size": 16,
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

    const reservations = (subnet, family) =>
      [...hwmap]
        .map(([k, networkInterface]) => {
          let ip = {};
          let addr = networkInterface.networkAddress(
            n => n.family === `IPv${family}`
          )?.address;

          if (addr && subnet.matchesAddress(addr)) {
            ip =
              family == 6 ? { "ip-addresses": [addr] } : { "ip-address": addr };
          }

          return {
            "hw-address": k,
            ...ip,
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
              reservations: reservations(subnet, "4")
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
              reservations: reservations(subnet, "6")
            };
          })
      }
    };

    for (const [name, data] of Object.entries({
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
