import { default_attribute_writable, addType } from "pacc";
import { Owner } from "./owner.mjs";
import { Subnet } from "./subnet.mjs";
import { networkAttributes } from "./network-support.mjs";

export class Network extends Owner {
  static name = "network";
  static priority = 2;
  static owners = ["location", "owner", "root"];
  static extends = Owner;
  static key = "name";
  static attributes = {
    ...networkAttributes,
    bridge: {
      ...default_attribute_writable,
      type: "network",
      collection: true
    },
    gateway: { ...default_attribute_writable, type: "host" }
  };


  static {
    addType(this);
  }

  kind;
  scope;
  metric;
  gateway;
  _bridge;

  get network() {
    return this;
  }

  get address() {
    for (const subnet of this.subnets) {
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

  get hosts() {
    if (this.bridge) {
      let hosts = new Set();
      for (const network of this.bridge) {
        hosts = hosts.union(network.directHosts());
      }
      return hosts;
    }

    return super.hosts;
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

  /**
   * @return {string}
   */
  get secretName() {
    return this._secretName ?? `${this.name}.password`;
  }
}
