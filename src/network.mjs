import { Owner } from "./owner.mjs";
import { Subnet } from "./subnet.mjs";
import { addType } from "./types.mjs";
import { networkProperties } from "./network-support.mjs";

const NetworkTypeDefinition = {
  name: "network",
  owners: ["location", "cluster", "owner", "root"],
  priority: 0.8,
  extends: Owner.typeDefinition,
  properties: {
    ...networkProperties,
    bridge: { type: "network", collection: true, writeable: true },
    gateway: { type: "host", collection: false, writeable: true }
  }
};

export class Network extends Owner {
  kind;
  scope;
  metric;
  gateway;
  #bridge;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return NetworkTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NetworkTypeDefinition);
  }

  get network() {
    return this;
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

  get bridge() {
    return this.#bridge;
  }

  set bridge(network) {
    this.#bridge = this.owner.addBridge(this, network);
    network.bridge = this.bridge; // TODO should happen in addBridge
  }
}
