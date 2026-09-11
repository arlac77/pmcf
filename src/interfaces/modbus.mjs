import { number_attribute_writable } from "pacc";
import { addType } from "../type.mjs";
import { Interface } from "./interface.mjs";

export class modbus extends Interface {
  static attributes = {
    address: { number_attribute_writable, name: "address" }
  };

  static commonNamePattern = /^modbus\d*$/;

  static {
    addType(this);
  }
}
