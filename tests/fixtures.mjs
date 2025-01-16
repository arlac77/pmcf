import { Location, Network, Host, Model, World } from "../src/model.mjs";

/**
 *
 * @param {World} world
 * @param {string|string[]} filter
 * @returns {Object|Array}
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
  L1.networks = [L1n1];

  const all = {
    L1,
    L2,
    "L1/n1": L1n1,
    "L1/n1/host2": {
      instanceof: Host,
      owner: L1n1,
      location: L1,
      os: "linux"
    },
    "L1/host1": {
      instanceof: Host,
      owner: L1,
      location: L1,
      os: "linux"
    },
    "model/m1": {
      instanceof: Model,
      owner: world,
      chassis: "server"
    }
  };

  for (const [k, v] of Object.entries(all)) {
    v.name = k;
  }

  if (typeof filter === "string") {
    return [all[filter], filter];
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
