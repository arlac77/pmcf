import { NetworkInterface } from "./network-interface.mjs";
import { addType } from "../type.mjs";
import { networkInterfaces_attribute } from "../common-attributes.mjs";

export class ethernet extends NetworkInterface {
  static attributes = {
    arpbridge: {
      ...networkInterfaces_attribute,
      name: "arpbridge"
    }
  };

  static commonNamePattern = /^(eth|end|en)\d+$/;

  static {
    addType(this);
  }

  arpbridge = new Map();
}
