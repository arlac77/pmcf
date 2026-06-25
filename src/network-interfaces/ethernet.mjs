import { default_attribute_writable } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";
import { addType} from "../type.mjs";

export class ethernet extends NetworkInterface {
  static specializationOf = NetworkInterface;
  static attributes = {
    arpbridge: {
      ...default_attribute_writable,
      name: "arpbridge",
      type: NetworkInterface,
      collection: true,
      owner: false
    }
  };

  static {
    addType(this);
  }

  static isCommonName(name) {
    return name.match(/^eth\d+$/);
  }

  arpbridge;

  get kind() {
    return this.constructor.name;
  }
}
