import { addType } from "pacc";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterface } from "./network-interface.mjs";

export class WireguardNetworkInterface extends SkeletonNetworkInterface {
  static name = "wireguard";
  static extends = NetworkInterface;
  static specializationOf = NetworkInterface;
  static owners = NetworkInterface.owners;
  static key = "name";

  static typeDefinition = this;

  static {
    addType(this);
  }

  get kind() {
    return "wireguard";
  }

  get ipAddresses() {
    return new Map();
  }
}
