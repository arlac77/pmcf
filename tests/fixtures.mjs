import { Location, Network, Host, World } from "../src/model.mjs";

/**
 *
 * @param {World} world
 * @param {string|string[]} filter
 * @returns {Object}
 */
export function world1(world, filter) {
  const L1 = { instanceof: Location, owner: world, description: "somewhere" };
  const L2 = {
    instanceof: Location,
    owner: world,
    description: "somewhere else"
  };
  const L1n1 = {
    instanceof: Network,
    owner: L1,
    scope: "global",
    kind: "wifi",
    metric: 1010,
    ssid: "ID2",
    description: "home wifi",
    ipv4: "192.168.1.0/24",
    ipv4_netmask: "24"
  };
  const L1n2 = {
    instanceof: Network,
    owner: L1,
    scope: "site",
    kind: "ethernet",
    metric: 1010,
    ipv4: "192.168.1.0/24",
    ipv4_netmask: "24"
  };
  L1.networks = [L1n1, L1n2];

  const all = {
    L1,
    "L1/n1": L1n1,
    "L1/n2": L1n2,
    "L1/n1/host2": {
      name: "host2",
      instanceof: Host,
      owner: L1n1,
      location: L1,
      os: "linux",
      networkInterfaces : {
        wifi0: {
          network: L1n2,
          metric: 1010,
          ssid: "ID2"
        }
      }
    },
    "L1/host1": {
      instanceof: Host,
      owner: L1,
      location: L1,
      os: "linux",
      services: {
        dns: { type: "dns", alias: "dns" }
      }
    },
    L2,
    "model/m1": {
      name: "model/m1",
      instanceof: Host,
      owner: world,
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
