import { addType } from "../types.mjs";
import {
  NetworkInterface,
  NetworkInterfaceTypeDefinition
} from "./network-interface.mjs";

export const EthernetNetworkInterfaceTypeDefinition = {
  name: "ethernet",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  extends: NetworkInterfaceTypeDefinition,
  priority: 0.1,
  properties: {
    arpbridge: { type: "network_interface", collection: true, writable: true }
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
