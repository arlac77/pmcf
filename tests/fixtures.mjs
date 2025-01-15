import { Location, Network, Host } from "../src/model.mjs";

export function world1(world) {
  const L1 = { instanceof: Location, owner: world, description: "somewhere" };
  const L2 = { instanceof: Location, description: "somewhere else" };

  return {
    L1,
    L2,
    "L1/n1": {
      instanceof: Network,
      owner: world,
      scope: "global",
      kind: "wifi",
      metric: 1010,
      ssid: "ID2",
      description: "home wifi"
    },
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
    }
  };
}
