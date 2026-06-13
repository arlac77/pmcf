import { addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";

export class tun extends NetworkInterface {
  static specializationOf = NetworkInterface;

  static {
    addType(this);
  }

  get kind() {
    return this.constructor.name;
  }

  async systemdDefinitions(dir, packageData) {}
}
