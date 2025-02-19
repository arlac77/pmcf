import { Owner } from "./owner.mjs";
import { Subnet } from "./subnet.mjs";
import { Host } from "./host.mjs";
import { DNSService } from "./dns.mjs";
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

  static get typeDefinition() {
    return {
      name: "network",
      extends: Owner,
      properties: {
        networks: { type: "network", collection: true },
        hosts: { type: Host, collection: true },
        clusters: { type: "cluster", collection: true },
        subnets: { type: Subnet, collection: true },
        dns: { type: DNSService, collection: false }
        //metric: { type: "number" }
        /*kind: { type: "string" },
        scope: { type: "string" },
        /*bridge: {},
        gateway: {}*/
      }
    };
  }

  constructor(owner, data) {
    super(owner, data);

    if (data.bridge) {
      this.bridge = owner.addBridge(this, data.bridge);
      delete data.bridge;
    }

    //this.read(data);

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
    this.#bridge = bridge;
  }
}
