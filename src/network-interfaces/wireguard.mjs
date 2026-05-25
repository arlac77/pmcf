import { addType } from "pacc";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";

const WireguardNetworkInterfaceTypeDefinition = {
  name: "wireguard",
  extends: NetworkInterfaceTypeDefinition,
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  key: "name"
};

export class WireguardNetworkInterface extends SkeletonNetworkInterface {
  static typeDefinition = WireguardNetworkInterfaceTypeDefinition;

  static {
    addType(this);
  }
  
  get kind() {
    return WireguardNetworkInterfaceTypeDefinition.name;
  }

  get ipAddresses() {
    return new Map();
  }
}
