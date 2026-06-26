import { addType } from "pmcf";
import { Owner } from "./owner.mjs";
import { networkAttributes, networks_attribute } from "./common-attributes.mjs";

export class Network extends Owner {
  static name = "network";
  static owners = [Owner, "root"];
  static attributes = {
    ...networkAttributes,
    bridge: {
      ...networks_attribute,
      name: "bridge"
    }
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
    for (const subnet of this.subnets.values()) {
      return subnet.address;
    }
  }

  networkNamed(name) {
    if (this.isNamed(name)) {
      return this;
    }
    return super.networkNamed(name);
  }

  get hosts() {
    if (this.bridge) {
      let hosts = new Set();
      for (const network of this.bridge) {
        hosts = hosts.union(network.hosts());
      }
      return hosts;
    }

    return super.hosts;
  }

  get bridge() {
    return this._bridge;
  }

  set bridge(network) {
    this._bridge = this.addBridge(this, network);
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
