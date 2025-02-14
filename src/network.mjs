import { Owner } from "./owner.mjs";
import { Subnet } from "./subnet.mjs";
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

  addObject(object) {
    super.addObject(object);
    if (object instanceof Subnet) {
      object.networks.add(this);
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
              otherSubnet.owner.addObject(subnet);
              for (const n of otherSubnet.networks) {
                subnet.networks.add(n);
              }
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
