import { base } from "./base.mjs";
import { addType } from "./type.mjs";

export class credential extends base {
  static {
    addType(this);
  }
}
