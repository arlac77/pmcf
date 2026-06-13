import { addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";

export class TUNNetworkInterface extends NetworkInterface {
  static name = "tun";
  static specializationOf = NetworkInterface;

  static {
    addType(this);
  }

  get kind() {
    return this.constructor.name;
  }

  async systemdDefinitions(dir, packageData) {}
}
