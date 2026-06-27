import { AggregatedMap } from "aggregated-map";
import { addType } from "pmcf";
import { Owner } from "./owner.mjs";
import { networkAttributes, networks_attribute } from "./common-attributes.mjs";

export class Network extends Owner {
  static name = "network";
  static owners = [Owner, "root"];
  static attributes = {
    ...networkAttributes,
    bridges: {
      ...networks_attribute,
      name: "bridges",
      backpointer: { ...networks_attribute, name: "bridges" }
    }
  };

  static {
    addType(this);
  }

  kind;
  scope;
  metric;
  gateway;
  bridges = new Set();

  constructor() {
    super();
    this.bridges.add(this);
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
    return this.bridges.size > 1
      ? new AggregatedMap([...this.bridges].map(network => network._hosts))
      : super.hosts;      
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
