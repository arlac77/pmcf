import { NetworkInterface } from "./network-interface.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";
import { addType } from "../types.mjs";

const TUNdNetworkInterfaceTypeDefinition = {
  name: "tun",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  extends: NetworkInterfaceTypeDefinition,
  priority: 0.1,
  attributes: {}
};

export class TUNNetworkInterface extends NetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return TUNdNetworkInterfaceTypeDefinition;
  }

  get kind() {
    return TUNdNetworkInterfaceTypeDefinition.name;
  }

  async systemdDefinitions(packageData) {}
}
