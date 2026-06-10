import { addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";

export class TUNNetworkInterface extends NetworkInterface {
  static name = "tun";
  static extends = NetworkInterfaceTypeDefinition;
  static specializationOf = NetworkInterfaceTypeDefinition;
  static owners = NetworkInterfaceTypeDefinition.owners;
  static key = "name";

  static typeDefinition = this;

  static {
    addType(this);
  }

  get kind() {
    return "tun";
  }

  async systemdDefinitions(dir, packageData) {}
}
