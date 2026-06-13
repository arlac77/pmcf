import { default_attribute_writable, addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";

export class ethernet extends NetworkInterface {
  static specializationOf = NetworkInterface;
  static attributes = {
    arpbridge: {
      ...default_attribute_writable,
      type: "network_interface",
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
