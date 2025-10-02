import { NetworkInterface } from "./network-interface.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";
import { addType } from "../types.mjs";

const TUNdNetworkInterfaceTypeDefinition = {
  name: "tun",
  extends: NetworkInterfaceTypeDefinition,
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  priority: 0.1,
  key: "name"
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
