import { addType } from "pacc";
import { Interface } from "./interface.mjs";

export class modbus extends Interface {
  static commonNamePattern = /^modbus\d*$/;

  static {
    addType(this);
  }

}
