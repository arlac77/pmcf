import { default_attribute_writable, addType } from "pacc";
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
  static typeDefinition = EthernetNetworkInterfaceTypeDefinition;

  static {
    addType(this);
  }

  static isCommonName(name) {
    return name.match(/^eth\d+$/);
  }

  arpbridge;

  get kind() {
    return EthernetNetworkInterfaceTypeDefinition.name;
  }
}
