import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Base } from "./base.mjs";
import { addType } from "./types.mjs";
import { writeLines } from "./utils.mjs";
import { serviceAddresses } from "./service.mjs";

const DHCPServiceTypeDefinition = {
  name: "dhcp",
  owners: ["location", "owner", "network", "cluster", "root"],
  priority: 0.1,
  properties: {}
};

export class DHCPService extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return DHCPServiceTypeDefinition;
  }

  constructor(owner, data) {
    if (!data.name) {
      data.name = DHCPServiceTypeDefinition.name; // TODO
    }
    super(owner, data);
    this.read(data, DHCPServiceTypeDefinition);

    owner.addObject(this);
  }

  async *preparePackages(dir) {
    const name = this.owner.name;
    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")[Symbol.asyncIterator]()],
      outputs: this.outputs,
      properties: {
        name: `kea-${name}`,
        description: `kea definitions for ${this.fullName}`,
        access: "private",
        dependencies: ["kea"]
      }
    };

    const loggers = [
      {
        "output-options": [
          {
            output: "systlog"
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

    const ddns = {
      DhcpDdns: {
        "ip-address": "127.0.0.1",
        port: 53001,
        "control-socket": {
          "socket-type": "unix",
          "socket-name": "/run/kea/ddns-ctrl-socket"
        },
        "tsig-keys": [],
        "forward-ddns": {},
        "reverse-ddns": {},
        loggers
      }
    };

    // console.log(this.owner.name,this.owner.networks());
/*
    const subnets = new Set();

    for (const network of this.owner.networks()) {
      for (const subnet of network.subnets()) {
        subnets.add(subnet);
      }
    }

    console.log([...subnets].map(s => s.address));
*/
    const reservations = [];

    for await (const {
      networkInterface,
      address,
      subnet,
      domainNames
    } of this.owner.networkAddresses()) {
      if (networkInterface.hwaddr) {
        reservations.push({
          "hw-address": networkInterface.hwaddr,
          "ip-address": networkInterface.rawAddress,
        });
      }
    }

    const dhcp4 = {
      Dhcp4: {
        "interfaces-config": {
          interfaces: ["end0"]
        },
        "control-socket": {
          "socket-type": "unix",
          "socket-name": "/run/kea/4-ctrl-socket"
        },
        "lease-database": {
          type: "memfile",
          "lfc-interval": 3600
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
        "option-data": [
          {
            name: "domain-name-servers",
            data: serviceAddresses(this, {
              type: "dns",
              priority: "<10"
            }).join(",")
          },
          {
            name: "domain-search",
            data: [...this.domains].join(",")
          }
        ],
        subnet4: [
          {
            id: 1,
            subnet: "192.168.1.0/24",
            pools: [
              {
                pool: "192.168.1.100 - 192.168.1.200"
              }
            ],
            "option-data": [
              {
                name: "routers",
                data: "192.168.1.254"
              }
            ],
            reservations /*: [
              {
                "hw-address": "1a:1b:1c:1d:1e:1f",
                "ip-address": "192.168.1.199"
              },
              {
                "client-id": "01:11:22:33:44:55:66",
                "ip-address": "192.168.1.198",
                hostname: "special-snowflake"
              }
            ]*/
          }
        ],
        loggers
      }
    };
    const dhcp6 = {
      Dhcp6: {
        "interfaces-config": {
          interfaces: []
        },
        "control-socket": {
          "socket-type": "unix",
          "socket-name": "/run/kea/6-ctrl-socket"
        },
        "lease-database": {
          type: "memfile",
          "lfc-interval": 3600
        },
        "expired-leases-processing": {
          "reclaim-timer-wait-time": 10,
          "flush-reclaimed-timer-wait-time": 25,
          "hold-reclaimed-time": 3600,
          "max-reclaim-leases": 100,
          "max-reclaim-time": 250,
          "unwarned-reclaim-cycles": 5
        },
        "renew-timer": 1000,
        "rebind-timer": 2000,
        "preferred-lifetime": 3000,
        "valid-lifetime": 4000,
        "option-data": [
          {
            name: "dns-servers",
            data: "2001:db8:2::45, 2001:db8:2::100"
          }
        ],
        subnet6: [
          {
            id: 1,
            subnet: "2001:db8:1::/64",
            pools: [
              {
                pool: "2001:db8:1::/80"
              }
            ],
            "pd-pools": [
              {
                prefix: "2001:db8:8::",
                "prefix-len": 56,
                "delegated-len": 64
              }
            ],
            "option-data": [
              {
                name: "dns-servers",
                data: "2001:db8:2::dead:beef, 2001:db8:2::cafe:babe"
              }
            ],
            reservations: [
              {
                duid: "01:02:03:04:05:0A:0B:0C:0D:0E",
                "ip-addresses": ["2001:db8:1::100"]
              }
            ]
          }
        ],
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
