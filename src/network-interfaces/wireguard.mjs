import { addType } from "pacc";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";

export class WireguardNetworkInterface extends SkeletonNetworkInterface {
  static name = "wireguard";
  static extends = NetworkInterfaceTypeDefinition;
  static specializationOf = NetworkInterfaceTypeDefinition;
  static owners = NetworkInterfaceTypeDefinition.owners;
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
