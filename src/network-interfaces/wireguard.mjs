import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";
import { addType } from "../types.mjs";

const WireguardNetworkInterfaceTypeDefinition = {
  name: "wireguard",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  extends: NetworkInterfaceTypeDefinition,
  priority: 0.1,
  properties: {}
};

export class WireguardNetworkInterface extends SkeletonNetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return WireguardNetworkInterfaceTypeDefinition;
  }

  get kind() {
    return WireguardNetworkInterfaceTypeDefinition.name;
  }

  get ipAddresses() {
    return new Map();
  }
}
