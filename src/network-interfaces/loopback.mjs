import { addType } from "pacc";
import { SUBNET_LOCALHOST_IPV4, SUBNET_LOCALHOST_IPV6 } from "pmcf";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";

const LoopbackNetworkInterfaceTypeDefinition = {
  name: "loopback",
  extends: NetworkInterfaceTypeDefinition,
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  key: "name"
};

const _localAddresses = new Map([
  ["127.0.0.1", SUBNET_LOCALHOST_IPV4],
  ["::1", SUBNET_LOCALHOST_IPV6]
]);

const _localDomains = new Set(["localhost"]);

export class LoopbackNetworkInterface extends SkeletonNetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return LoopbackNetworkInterfaceTypeDefinition;
  }

  static isCommonName(name) {
    return name.match(/^lo\d*$/);
  }

  get kind() {
    return LoopbackNetworkInterfaceTypeDefinition.name;
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
