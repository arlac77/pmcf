import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

const LocationTypeDefinition = {
  name: "location",
  owners: [Owner.typeDefinition, "location", "root"],
  priority: 1.0,
  extends: Owner.typeDefinition,
  properties: {
    country: { type: "string", writeable: true },
    locales: { type: "string", collection: true, writeable: true }
  }
};

export class Location extends Owner {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return LocationTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, LocationTypeDefinition);
  }

  get location() {
    return this;
  }


  locationNamed(name) {
    if (this.isNamed(name)) {
      return this;
    }

    return super.locationNamed(name);
  }

  get network() {
    return [...this.typeList("network")][0] || super.network;
  }
}
