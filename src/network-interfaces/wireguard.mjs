import { addType } from "pacc";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterface } from "./network-interface.mjs";

export class WireguardNetworkInterface extends SkeletonNetworkInterface {
  static name = "wireguard";
  static specializationOf = NetworkInterface;
  static owners = NetworkInterface.owners;
  static key = "name";


  static {
    addType(this);
  }

  get kind() {
    return this.constructor.name;
  }

  get ipAddresses() {
    return new Map();
  }
}
