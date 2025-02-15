import { Owner } from "./owner.mjs";
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
        networks: { type: "network", collection: true },
        hosts: { type: "host", collection: true },
        clusters: { type: "cluster", collection: true },
        subnets: { type: "subnet", collection: true },
        dns: { type: "dns", collection: false },
        country: { type: "string" }
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
