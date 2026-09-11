import { addType } from "pacc";
import { SkeletonNetworkInterface } from "./skeleton-network-interface.mjs";
import { NetworkInterface } from "./network-interface.mjs";

export class wireguard extends SkeletonNetworkInterface {
  static specializationOf = NetworkInterface;

  static {
    addType(this);
  }

  get ipAddresses() {
    return new Map();
  }
}
