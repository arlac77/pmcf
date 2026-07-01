import { AggregatedMap } from "aggregated-map";
import { addType, assign } from "pmcf";
import { Owner } from "./owner.mjs";
import {
  networkAttributes,
  bridges_attribute,
  subnets_attribute
} from "./common-attributes.mjs";
import { Subnet } from "./subnet.mjs";

export class Network extends Owner {
  static name = "network";
  static owners = [Owner, "root"];
  static attributes = {
    ...networkAttributes,
    bridges: bridges_attribute
  };

  static {
    addType(this);
  }

  kind;
  scope;
  metric;
  bridges = new Set();

  get gateway() {
    for (const b of [this, ...this.bridges]) {
      if (b._gateway) {
        return b._gateway;
      }
    }
  }

  set gateway(value) {
    this._gateway = value;
  }

  get network() {
    return this;
  }

  get address() {
    for (const subnet of this.subnets.values()) {
      return subnet.address;
    }
  }

  get hosts() {
    return this.bridges.size > 0
      ? new AggregatedMap(
          [this, ...this.bridges].map(network => network.directHosts)
        )
      : super.hosts;
  }

  get subnets() {
    if (!this._subnets.get("fe80::/64")) {
      const linkLocal = new Subnet("fe80::/64");
      this._subnets.set(linkLocal.address,linkLocal);
      //assign(subnets_attribute, this, linkLocal);
    }

    return this.bridges.size > 0
      ? new AggregatedMap(
          [this, ...this.bridges].map(network => network._subnets)
        )
      : super.subnets;
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
