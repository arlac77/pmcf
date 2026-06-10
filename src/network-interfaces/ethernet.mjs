import { default_attribute_writable, addType } from "pacc";
import { NetworkInterface } from "./network-interface.mjs";

export class EthernetNetworkInterface extends NetworkInterface {
  static name = "ethernet";
  static extends = NetworkInterface;
  static specializationOf = NetworkInterface;
  static owners = NetworkInterface.owners;
  static key = "name";
  static attributes = {
    arpbridge: {
      ...default_attribute_writable,
      type: "network_interface",
      collection: true
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
