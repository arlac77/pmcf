import { Owner } from "./owner.mjs";
import { asArray } from "./utils.mjs";
import { addType } from "./types.mjs";

export class Network extends Owner {
  kind;
  scope;
  metric;
  gateway;
  #bridge;

  static {
    addType(this);
  }

  static get typeName() {
    return "network";
  }

  constructor(owner, data) {
    super(owner, data);

    if (data.subnets) {
      this.addSubnets(data.subnets);
      delete data.subnets;
    }

    if (data.bridge) {
      this.bridge = owner.addBridge(this, data.bridge);
      delete data.bridge;
    }

    Object.assign(this, data);

    if (typeof this.gateway === "string") {
      this.finalize(() => (this.gateway = this.owner.hostNamed(this.gateway)));
    }
  }

  get network() {
    return this;
  }

  networkNamed(name) {
    if (this.fullName === name) {
      return this;
    }
    return super.networkNamed(name);
  }

  addSubnets(value) {
    for (const address of asArray(value)) {
      const subnet = this.addSubnet(address);
      subnet.networks.add(this);
    }
  }

  get bridge() {
    return this.#bridge;
  }

  set bridge(bridge) {
    for (const network of bridge) {
      if (network instanceof Network && network !== this) {
        for (const subnet of this.subnets()) {
          for (const otherSubnet of network.subnets()) {
            if (
              subnet !== otherSubnet &&
              subnet.address === otherSubnet.address
            ) {
              /*console.log(
                "SHARE SUBNETS",
                subnet.owner.toString(),
                otherSubnet.owner.toString()
              );*/

              otherSubnet.owner.addObject(subnet);
              for (const n of otherSubnet.networks) {
                subnet.networks.add(n);
              }

              //console.log(subnet.toString(),[...subnet.networks].map(n=>n.toString()));
            }
          }
        }
      }
    }

    this.#bridge = bridge;
  }

  get propertyNames() {
    return [
      ...super.propertyNames,
      "kind",
      "scope",
      "metric",
      "bridge",
      "gateway"
    ];
  }
}
