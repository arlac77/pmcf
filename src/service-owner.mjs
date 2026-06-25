import { default_attribute_writable } from "pacc";
import { Base, addType } from "pmcf";

export class ServiceOwner extends Base {
  static name = "service-owner";
  static priority = 1.9;
  static owners = ["owner", "network", "root"];
  static attributes = {
    services: {
      ...default_attribute_writable,
      name: "services",
      type: "service",
      collection: true
    }
  };

  static {
    addType(this);
  }

  _services = new Map();

  set services(service) {
    this._services.set(service.name, service);
  }

  get services() {
    return this._services;
  }

  materializeExtends() {
    super.materializeExtends();

    for (const [name, service] of this.mapFromDirections(
      ["extends"],
      "_services"
    )) {
      const present = this._services.get(service.name);

      if (present) {
        present.extends.add(service);
      } else {
        this.services = service.forOwner(this);
      }
    }
  }

}
