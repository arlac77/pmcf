import { Location, Network, Subnet, Host, Cluster, Root } from "pmcf";

/**
 *
 * @param {Root} root
 * @param {string|string[]} filter
 * @returns {Object}
 */
export function root1(root, filter) {
  const L1 = { instanceof: Location, owner: root, description: "somewhere", "country": "DE" };
  const L2 = {
    instanceof: Location,
    owner: root,
    description: "somewhere else"
  };

  const s1 = { instanceof: Subnet, name: "192.168.1/24", networks: [] };

  const L1n1 = {
    instanceof: Network,
    owner: L1,
    scope: "global",
    kind: "wifi",
    metric: 1010,
    ssid: "ID2",
    description: "home wifi",
    subnets: [s1]
  };
  const L1n2 = {
    instanceof: Network,
    owner: L1,
    scope: "site",
    kind: "ethernet",
    metric: 1010,
    subnets: [s1]
  };

  L1.networks = [L1n1, L1n2];
  s1.networks.push(L1n1);
  s1.networks.push(L1n2);

  const p1 = {
    name: "p1",
    networkInterfaces: {
      eth0: {
        network: L1n1,
        rawAddresses: ["192.168.1.10"]
      }
    }
  };
  const p2 = {
    name: "p2",
    networkInterfaces: {
      eth0: {
        network: L1n1,
        rawAddresses: ["192.168.1.11"]
      }
    }
  };

  const L1C1 = {
    name: "C1",
    instanceof: Cluster,

    hosts: [p1, p2]
  };

  p1.owner = L1C1;
  p2.owner = L1C1;

  const all = {
    L1,
    "L1/C1": L1C1,
    "L1/C1/p1": p1,
    "L1/C1/p2": p2,
    "L1/n1": L1n1,
    "L1/n2": L1n2,
    "L1/n1/host2": {
      name: "host2",
      instanceof: Host,
      owner: L1n1,
      location: L1,
      os: "linux",
      networkInterfaces: {
        wlan0: {
          network: L1n1,
          metric: 1010,
          ssid: "ID2",
          rawAddresses: ["192.168.1.2"],
          cidrAddresses: ["192.168.1.2/24"],
          kind: "wifi"
        }
      }
    },
    "L1/host1": {
      instanceof: Host,
      owner: L1,
      location: L1,
      os: "linux",
      networkInterfaces: {
        eth0: {
          network: L1n1,
          metric: 1010,
          rawAddresses: ["192.168.1.1"],
          cidrAddresses: ["192.168.1.1/24"]
        }
      },
      services: {
        dns: { type: "dns", alias: "dns" }
      }
    },
    L2,
    "model/m1": {
      name: "model/m1",
      instanceof: Host,
      owner: root,
      isModel: true,
      chassis: "server"
    }
  };

  for (const [k, v] of Object.entries(all)) {
    if (!v.name) {
      const path = k.split("/");
      v.name = path.pop();
    }
  }

  if (typeof filter === "string") {
    return all[filter];
  }

  const filtered = {};
  for (const [k, v] of Object.entries(all)) {
    if (filter && filter.indexOf(k) < 0) {
    } else {
      filtered[k] = v;
    }
  }

  return filtered;
}
