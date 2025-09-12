import { default_attribute_writable } from "pacc";
import { Owner } from "./owner.mjs";
import { Subnet } from "./subnet.mjs";
import { addType } from "./types.mjs";
import { networkProperties } from "./network-support.mjs";

const NetworkTypeDefinition = {
  name: "network",
  owners: ["location", "owner", "root"],
  priority: 0.8,
  extends: Owner.typeDefinition,
  properties: {
    ...networkProperties,
    bridge: {
      ...default_attribute_writable,
      type: "network",
      collection: true
    },
    gateway: { ...default_attribute_writable, type: "host" }
  }
};

export class Network extends Owner {
  kind;
  scope;
  metric;
  gateway;
  _bridge;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return NetworkTypeDefinition;
  }

  get network() {
    return this;
  }

  get address() {
    for (const subnet of this.subnets()) {
      return subnet.address;
    }
  }

  networkNamed(name) {
    if (this.isNamed(name)) {
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

  hosts() {
    if (this.bridge) {
      let hosts = new Set();
      for (const network of this.bridge) {
        hosts = hosts.union(network.directHosts());
      }
      return hosts;
    }

    return super.hosts();
  }

  get bridge() {
    return this._bridge;
  }

  set bridge(network) {
    this._bridge = this.owner.addBridge(this, network);
    network.bridge = this.bridge; // TODO should happen in addBridge
  }

  set secretName(value) {
    this._secretName = value;
  }

  get secretName() {
    return this._secretName ?? `${this.name}.password`;
  }
}
