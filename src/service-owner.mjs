import { default_attribute_writable, addType } from "pacc";
import { Base, Service } from "pmcf";

export class ServiceOwner extends Base {
  static name = "service-owner";
  static priority = 1.9;
  static owners = ["owner", "network", "root"];
  static extends = Base;
  static key = "name";
  static attributes = {
    services: {
      ...default_attribute_writable,
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

  addObject(object) {
    if (object instanceof Service) {
      this._services.set(object.name, object);
    } else {
      super.addObject(object);
    }
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

  typeNamed(typeName, name) {
    if (typeName === "service") {
      const service = this.services.get(name);
      if (service) {
        return service;
      }
    }

    if (typeName === "number") {
      throw new Error("invalidType", { cause: typeName });
    }
    return super.typeNamed(typeName, name);
  }

  /**
   *
   * @param {string} name
   * @returns {Service|undefined}
   */
  named(name) {
    return this.services.get(name);
  }
}
