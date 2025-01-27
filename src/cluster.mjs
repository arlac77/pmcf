import { Owner } from "./owner.mjs";

export class Cluster extends Owner {
  static get typeName() {
    return "cluster";
  }
}
