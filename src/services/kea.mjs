import { join } from "node:path";
import {
  reverseArpa,
  addressType,
  FAMILY_IPV4,
  FAMILY_IPV6,
  ADDRESS_TYPE_LOOPBACK
} from "ip-utilties";
import {
  string_attribute_writable,
  string_collection_attribute_writable,
  number_attribute_writable,
  boolean_attribute_writable_true,
  default_collection_attribute_writable,
  extendingAttributeIterator,
  asArray
} from "pacc";
import {
  addType,
  Subnet,
  CoreService,
  Endpoint,
  sortDescendingByPriority,
  bind_key,
  systemdCredentialFileName,
  credential
} from "pmcf";
import { FAMILY_UNIX, PROTOCOL_TCP } from "../constants.mjs";
import { writeLines } from "../utils.mjs";

class kea_subnet extends Subnet {
  static attributes = {
    pool: {
      ...string_collection_attribute_writable,
      name: "pool"
    },
    clientClasses: {
      ...string_collection_attribute_writable,
      name: "clientClasses",
      externalName: "client-classes"
    }
  };

  static {
    addType(this);
  }

  pool = [];
}

const SCOPE_KEA = "kea";

export class kea extends CoreService {
  static attributes = {
    subnets: {
      ...default_collection_attribute_writable,
      type: kea_subnet,
      name: "subnets"
    },
    peers: {
      ...default_collection_attribute_writable,
      type: CoreService,
      name: "peers",
      deferredExpression: true
    },
    keys: {
      ...default_collection_attribute_writable,
      name: "keys",
      type: bind_key,
      deferredExpression: true
    },
    dnsServerEndpoints: {
      ...default_collection_attribute_writable,
      type: Endpoint,
      name: "dnsServerEndpoints",
      deferredExpression: true
    },
    "ddns-send-updates": {
      ...boolean_attribute_writable_true,
      name: "ddns-send-updates",
      scope: SCOPE_KEA
    },
    "renew-timer": {
      ...number_attribute_writable,
      name: "renew-timer",
      scope: SCOPE_KEA,
      default: 900
    },
    "rebind-timer": {
      ...number_attribute_writable,
      name: "rebind-timer",
      scope: SCOPE_KEA,
      default: 1800
    },
    "valid-lifetime": {
      ...number_attribute_writable,
      name: "valid-lifetime",
      mandatory: true,
      scope: SCOPE_KEA,
      default: 86400
    },
    "ddns-conflict-resolution-mode": {
      ...string_attribute_writable,
      name: "ddns-conflict-resolution-mode",
      scope: SCOPE_KEA
      //values: new Set(["check-exists-with-dhcid","no-check-with-dhcid"])
    }
  };
  static service = {
    extends: ["dhcp"],
    systemUserName: "kea",
    systemGroupName: "kea",
    services: {
      "kea-dhcp-ddns": {
        systemdService: "kea-dhcp-ddns.service",
        endpoints: [
          {
            family: FAMILY_IPV4,
            kind: "loopback",
            port: 53001,
            protocol: PROTOCOL_TCP,
            tls: false
          }
        ],
        services: {
          "kea-control-ddns": {
            endpoints: [
              {
                family: FAMILY_UNIX,
                path: "/run/kea/ctrl-ddns"
              }
            ]
          }
        }
      },
      "kea-dhcp4": {
        systemdService: "kea-dhcp4.service",
        services: {
          "kea-ha-4": {
            endpoints: [
              {
                family: FAMILY_IPV4,
                port: 53003,
                pathname: "/",
                protocol: PROTOCOL_TCP,
                tls: false
              }
            ]
          },
          "kea-control-dhcp4": {
            endpoints: [
              {
                family: FAMILY_UNIX,
                path: "/run/kea/ctrl-4"
              }
              /*{
            family: FAMILY_IPV4,
            port: 53005,
            pathname: "/"
          }*/
            ]
          }
        }
      },
      "kea-dhcp6": {
        systemdService: "kea-dhcp6.service",
        services: {
          "kea-ha-6": {
            endpoints: [
              {
                family: FAMILY_IPV6,
                port: 53004,
                pathname: "/",
                protocol: PROTOCOL_TCP,
                tls: false
              }
            ]
          },
          "kea-control-dhcp6": {
            endpoints: [
              {
                family: FAMILY_UNIX,
                path: "/run/kea/ctrl-6"
              }
              /*{
            family: FAMILY_IPV6,
            port: 53005,
            pathname: "/"
          }*/
            ]
          }
        }
      }
    }
  };

  static {
    addType(this);
  }

  subnets = new Map();

  get credentials() {
    //TODO maybe introduce synthetic extends
    asArray(this.keys).forEach(key => {
      const cred = new credential(this);
      cred.name = `key.${key.name}.tsig`;
      cred._tags.add("kea-dhcp-ddns.service");
      this._credentials.set(cred.name, cred);
    });

    return super.credentials;
  }

  listenInterfaces(family) {
    return this.endpoints(
      endpoint =>
        endpoint.type === "dhcp" &&
        endpoint.family === family &&
        endpoint.networkInterface.enabled &&
        endpoint.networkInterface.kind !== "loopback" &&
        endpoint.networkInterface.kind !== "tun"
    ).map(endpoint => `${endpoint.networkInterface.name}/${endpoint.address}`);
  }

  commonConfig(family) {
    const cfg = {
      "interfaces-config": {
        interfaces: this.listenInterfaces(`IPv${family}`)
      },
      "control-sockets": this.endpoints(`kea-control-dhcp${family}`).map(e =>
        toSocket(e)
      ),
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
                "this-server-name": this.host.name,
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
                peers: asArray(this.peers)
                  .sort(sortDescendingByPriority)
                  .reduce((a, kea) => {
                    if (!kea.host.isCluster) {
                      const ctrlAgentEndpoint = kea.endpoint(
                        `kea-ha-${family}`
                      );

                      if (ctrlAgentEndpoint) {
                        const i = a.length;
                        a.push({
                          name: kea.host.name,
                          role:
                            i === 0 ? "primary" : i > 1 ? "backup" : "standby",
                          url: ctrlAgentEndpoint.url,
                          "auto-failover": i <= 1
                        });
                      }
                    }
                    return a;
                  }, [])
              }
            ]
          }
        }
      ],
      "option-data": [
        {
          name: family == 4 ? "domain-name-servers" : "dns-servers",
          data: asArray(
            this.dnsServerEndpoints
              .filter(
                endpoint =>
                  endpoint.family === `IPv${family}` &&
                  addressType(endpoint.address) !== ADDRESS_TYPE_LOOPBACK
              )
              .map(endpoint => endpoint.address)
          ).join(",")
        },
        {
          name: "domain-search",
          data: [...this.domains].join(",")
        }
      ]
    };

    for (const [path, attribute] of extendingAttributeIterator(
      this.constructor,
      attribute =>
        attribute.scope === SCOPE_KEA && this[attribute.name] !== undefined
    )) {
      const name = path.join(".");
      cfg[name] = this[name];
    }

    return cfg;
  }

  async *preparePackages(dir) {
    const ctrlAgentEndpoint = this.endpoint("kea-ha-4");

    if (!ctrlAgentEndpoint) {
      return;
    }

    const host = this.host;
    const source = host.owner;
    const subnets = [...this.subnets.values()];

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

    const dnsServersSlot = names =>
      names.map(name => {
        return {
          name,
          "dns-servers": asArray(this.dnsServerEndpoints)
            .filter(
              endpoint =>
                endpoint.family === FAMILY_IPV4 &&
                addressType(endpoint.address) !== ADDRESS_TYPE_LOOPBACK
            )
            .map(endpoint => {
              return { "ip-address": endpoint.address };
            })
        };
      });

    const ddnsEndpoint = this.endpoint("kea-dhcp-ddns");

    const ddns = {
      DhcpDdns: {
        "ip-address": ddnsEndpoint.address,
        port: ddnsEndpoint.port,
        "control-socket": toSocket(this.endpoint("kea-control-ddns")),
        "tsig-keys": asArray(this.keys).map(key => {
          return {
            name: key.name,
            algorithm: key.algorithm,
            "secret-file": systemdCredentialFileName(
              "kea-dhcp-ddns.service",
              `key.${key.name}.tsig`
            )
          };
        }),
        "forward-ddns": {
          "ddns-domains": dnsServersSlot([...this.domains])
        },
        "reverse-ddns": {
          "ddns-domains": dnsServersSlot(
            subnets.map(s => s.prefix).map(prefix => reverseArpa(prefix))
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

    for (const { networkInterface } of source.networkAddresses()) {
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
              family === "6"
                ? { "ip-addresses": [addr] }
                : { "ip-address": addr };
          }

          let ids = { "hw-address": k };

          if (family === "4") {
            const dhcpClientId = networkInterface.dhcpClientId;
            if (dhcpClientId !== undefined) {
              ids = { "client-id": dhcpClientId };
            }
          }

          return {
            ...ids,
            ...ip,
            hostname: networkInterface.domainName,
            "client-classes": ["SKIP_DDNS"]
          };
        })
        .sort((a, b) => a.hostname?.localeCompare(b.hostname));

    const dhcp4 = {
      Dhcp4: {
        ...this.commonConfig("4"),
        subnet4: subnets
          .filter(s => s.family === FAMILY_IPV4)
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: [{ pool: subnet.pool.join(" - ") }],
              reservations: reservations(subnet, "4"),
              "option-data": [
                {
                  name: "routers",
                  data: this.network.gateway.address
                }
              ]
            };
          }),
        "dhcp-ddns": dhcpServerDdns,
        loggers
      }
    };
    const dhcp6 = {
      Dhcp6: {
        ...this.commonConfig("6"),
        subnet6: subnets
          .filter(s => s.family === FAMILY_IPV6)
          .map((subnet, index) => {
            return {
              id: index + 1,
              subnet: subnet.longAddress,
              pools: [{ pool: subnet.pool.join(" - ") }],
              reservations: reservations(subnet, "6")
            };
          }),
        "dhcp-ddns": dhcpServerDdns,
        loggers
      }
    };

    const packageData = await this.preparePackage(dir);

    await this.writeSystemdCredentialConfig(dir, "kea-dhcp4.service");
    await this.writeSystemdCredentialConfig(dir, "kea-dhcp6.service");
    await this.writeSystemdCredentialConfig(dir, "kea-dhcp-ddns.service");

    for (const [name, data] of Object.entries({
      "kea-dhcp-ddns": ddns,
      "kea-dhcp4": dhcp4,
      "kea-dhcp6": dhcp6
    })) {
      loggers[0].name = name;
      await writeLines(
        join(dir, "etc/kea"),
        `${name}.conf`,
        JSON.stringify(data, undefined, 2)
      );
    }

    yield packageData;
  }
}

function toSocket(endpoint) {
  switch (endpoint.family) {
    case FAMILY_IPV4:
    case FAMILY_IPV6:
      return {
        "socket-type": "http",
        "socket-address": endpoint.address.hostname,
        "socket-port": endpoint.port,
        authentication: {
          type: "basic",
          realm: "Kea Control Agent",
          directory: "/etc/kea",
          clients: [
            {
              "user-file": "kea-api-user",
              "password-file": "kea-api-password"
            }
          ]
        }
      };
    case FAMILY_UNIX:
      return {
        "socket-type": FAMILY_UNIX,
        "socket-name": endpoint?.path
      };
  }
}
