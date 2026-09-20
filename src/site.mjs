import { addType } from "pmcf";
import { owner } from "./owner.mjs";

export class site extends owner {
  static priority = 10;
  static owners = [owner, "root"];

  static {
    addType(this);
  }

  get site()
  {
    return this;
  }
}