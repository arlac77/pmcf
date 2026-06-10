import { default_attribute_writable, addType } from "pacc";
import {
  NetworkInterface,
  NetworkInterfaceTypeDefinition
} from "./network-interface.mjs";

export class EthernetNetworkInterface extends NetworkInterface {
  static   name= "ethernet";
  static extends= NetworkInterfaceTypeDefinition;
  static specializationOf= NetworkInterfaceTypeDefinition;
  static owners= NetworkInterfaceTypeDefinition.owners;
  static key= "name";
  static attributes= {
    arpbridge: {
      ...default_attribute_writable,
      type: "network_interface",
      collection: true
    }
  };

  static typeDefinition = this;

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
