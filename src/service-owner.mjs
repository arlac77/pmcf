import { base } from "./base.mjs";
import { addType } from "./type.mjs";
import { services_attribute } from "./common-attributes.mjs";

export class ServiceOwner extends base {
  static name = "service-owner";
  static priority = 1.9;
  static owners = ["owner", "site", "network", "root"];
  static attributes = {
    services: services_attribute
  };

  static {
    addType(this);
  }

  _services = new Map();

  set services(value) {
    this._services = value;
  }

  get services() {
    return this._services;
  }
}
