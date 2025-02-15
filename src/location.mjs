import { Owner } from "./owner.mjs";
import { Network } from "./network.mjs";
import { Subnet } from "./subnet.mjs";
import { Host } from "./host.mjs";
import { DNSService } from "./dns.mjs";
import { Cluster } from "./cluster.mjs";
import { addType } from "./types.mjs";

export class Location extends Owner {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return {
      name: "location",
      extends: Owner,
      properties: {
        networks: { type: Network, collection: true },
        hosts: { type: Host, collection: true },
        clusters: { type: Cluster, collection: true },
        subnets: { type: Subnet, collection: true },
        dns: { type: DNSService },
        country: { type: "string" },
        locales: { type: "string", collection: true }
      }
    };
  }

  get location() {
    return this;
  }

  locationNamed(name) {
    if (this.fullName === name) {
      return this;
    }

    return super.locationNamed(name);
  }

  get network() {
    return [...this.typeList("network")][0] || super.network;
  }
}
