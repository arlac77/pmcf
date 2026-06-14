import { addType as addTypeBasic } from "pacc";
import { addServiceType } from "pmcf";

export function addType(type) {
  addTypeBasic(type);

  if (type.service) {
    addServiceType(type.service, type.name);
  }
}
