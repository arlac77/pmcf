import { default_attribute_writable } from "pacc";
import { addType } from "../types.mjs";
import {
  NetworkInterface,
  NetworkInterfaceTypeDefinition
} from "./network-interface.mjs";

export const EthernetNetworkInterfaceTypeDefinition = {
  name: "ethernet",
  extends: NetworkInterfaceTypeDefinition,
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  key: "name",
  attributes: {
    arpbridge: {
      ...default_attribute_writable,
      type: "network_interface",
      collection: true
    }
  }
};

export class EthernetNetworkInterface extends NetworkInterface {
  arpbridge;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return EthernetNetworkInterfaceTypeDefinition;
  }

  static isCommonName(name) {
    return name.match(/eth\d+$/);
  }

  get kind() {
    return EthernetNetworkInterfaceTypeDefinition.name;
  }
}
