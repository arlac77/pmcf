import { addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";

const TUNdNetworkInterfaceTypeDefinition = {
  name: "tun",
  extends: NetworkInterfaceTypeDefinition,
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
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
