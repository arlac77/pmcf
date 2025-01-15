import { Location, Network } from "../src/model.mjs";

export function world1(world) {
  return {
    "L1/n1": {
      instanceof: Network,
      owner: world,
      scope: "global",
      kind: "wifi",
      metric: 1010,
      ssid: "ID2",
      description: "home wifi"
    },
    L1: { instanceof: Location, owner: world, description: "somewhere" },
    L2: { instanceof: Location, description: "somewhere else" }
  };
}
