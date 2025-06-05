import { SUBNET_LOCALHOST_IPV4, SUBNET_LOCALHOST_IPV6 } from "pmcf";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";
import { addType } from "../types.mjs";

const LoopbackNetworkInterfaceTypeDefinition = {
  name: "loopback",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  extends: NetworkInterfaceTypeDefinition,
  priority: 0.1,
  properties: {}
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

  static isCommonName(name)
  {
    return name.match(/lo\d+$/);
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NetworkInterfaceTypeDefinition);
  }

  get kind() {
    return LoopbackNetworkInterfaceTypeDefinition.name;
  }

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
}
