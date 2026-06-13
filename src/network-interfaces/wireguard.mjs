import { addType } from "pacc";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterface } from "./network-interface.mjs";

export class wireguard extends SkeletonNetworkInterface {
  static specializationOf = NetworkInterface;

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
