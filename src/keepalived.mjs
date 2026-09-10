import { duration_attribute_writable } from "pacc";
import { addType } from "pmcf";

import { cluster } from "./cluster.mjs";

export class keepalived extends cluster {
  static priority = 1.5;
  static attributes = {
    checkInterval: {
      ...duration_attribute_writable,
      name: "checkInterval",
      default: 60
    }
  };

  static {
    addType(this);
  }
}
