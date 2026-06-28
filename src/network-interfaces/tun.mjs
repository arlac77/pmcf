import { addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";

export class tun extends NetworkInterface {
  static specializationOf = NetworkInterface;

  static {
    addType(this);
  }

  async systemdDefinitions(dir, packageData) {}
}
