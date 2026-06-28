import { addType } from "pacc";
import { SUBNET_LOCALHOST_IPV4, SUBNET_LOCALHOST_IPV6 } from "pmcf";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterface } from "./network-interface.mjs";

const _localAddresses = new Map([
  ["127.0.0.1", SUBNET_LOCALHOST_IPV4],
  ["::1", SUBNET_LOCALHOST_IPV6]
]);

const _localDomains = new Set(["localhost"]);

export class loopback extends SkeletonNetworkInterface {
  static specializationOf = NetworkInterface;

  static {
    addType(this);
  }

  static isCommonName(name) {
    return name.match(/^lo\d*$/);
  }

  set scope(v) {}
  get scope() {
    return "host";
  }

  get localDomains() {
    return _localDomains;
  }

  get domainNames() {
    return _localDomains;
  }

  get hostName() {
    return "localhost";
  }

  get ipAddresses() {
    return _localAddresses;
  }

  set mtu(v) {}

  get mtu() {
    return 16436;
  }
}
