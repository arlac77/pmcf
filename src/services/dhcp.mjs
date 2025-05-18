import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import {
  Service,
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
  path: "/",
  method: "get",
  protocol: "tcp",
  tls: false
};

const ddnsEndpoint = {
  type: "kea-ddns",
  port: 53001,
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
      na => na.networkInterface.kind === "loopback"
    )) {
      endpoints.push(
        new HTTPEndpoint(this, na, controlAgentEndpoint),
        new Endpoint(this, na, ddnsEndpoint)
      );
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
        dependencies: ["kea>=2.6.2"]
      }
    };

        const ctrlAgentEndpoint = this.endpoint(
      e => e.type === "kea-control-agent"
    );

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
      "valid-lifetime": 3600,
      "hooks-libraries": [
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
                peers: [
                  {
                    name: name,
                    url: ctrlAgentEndpoint.url,
                    role: "primary"
                  } /*,
                  {
                    name: "server2",
                    url: "http://172.28.0.254:8000/",
                    role: "standby"
                  }*/
                ]
              }
            ]
          }
        }
      ]
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

    const toUnix = endpoint => {
      return {
        "socket-type": "unix",
        "socket-name": endpoint?.path
      };
    };

    const ctrlAgent = {
      "Control-agent": {
        "http-host": ctrlAgentEndpoint?.host,
        "http-port": ctrlAgentEndpoint?.port,
        "control-sockets": {
          dhcp4: toUnix(this.endpoint(e => e.type === "kea-control-dhcp4")),
          dhcp6: toUnix(this.endpoint(e => e.type === "kea-control-dhcp6")),
          d2: toUnix(this.endpoint(e => e.type === "kea-control-ddns"))
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
        "control-socket": toUnix(
          this.endpoint(e => e.type === "kea-control-ddns")
        ),
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

    const subnets = [...this.subnets].filter(
      s => s !== SUBNET_LOCALHOST_IPV4 && s !== SUBNET_LOCALHOST_IPV6
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
        subnet4: subnets
          .filter(s => s.family === "IPv4")
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: [{ pool: subnet.dhcpUsableAddressRange.join(" - ") }],
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
        subnet6: subnets
          .filter(s => s.family === "IPv6")
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: [{ pool: subnet.addressRange.join(" - ") }],

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
