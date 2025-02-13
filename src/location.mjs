import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";

export class Location extends Owner {
  static {
    addType(this);
  }

  static get typeName() {
    return "location";
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

  /*
  *subnets() {
   // yield* super.subnets();
    
    for(const network of this.networks()) {
     // console.log(network.toString());
      yield* network.typeList("subnet");
    }
  }
  */
}
