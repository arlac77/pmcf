import { Location, Network, Host, Model } from "../src/model.mjs";

export function world1(world, filter) {
  const L1 = { instanceof: Location, owner: world, description: "somewhere" };
  const L2 = { instanceof: Location, description: "somewhere else" };
  const L1n1 = {
    instanceof: Network,
    owner: world,
    scope: "global",
    kind: "wifi",
    metric: 1010,
    ssid: "ID2",
    description: "home wifi"
  };

  const all = {
    L1,
    L2,
    "L1/n1": L1n1,
    "L1/n1/host2": {
      instanceof: Host,
      owner: world,
      os: "linux"
      //   location: L1
    },
    "L1/host1": {
      instanceof: Host,
      owner: world,
      os: "linux"
      //   location: L1
    },
    "model/m1": {
      instanceof: Model,
      owner: world,
      chassis: "server"
    }
  };

  const filtered = {};
  for (const [k, v] of Object.entries(all)) {
    if (filter && filter.indexOf(k) < 0) {
    } else {
      v.name = k;
      filtered[k] = v;
    }
  }

  return filtered;
}
