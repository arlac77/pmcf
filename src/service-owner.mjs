import { Base } from "pmcf";
import { objectFilter } from "./filter.mjs";
import { types } from "./types.mjs";

export class ServiceOwner extends Base {
  _services = [];

  get services() {
    return this._services;
  }

  set services(service) {
    const present = this._services.find(s => s.name === service.name);

    if (!present) {
      this._services.push(service);
    }
  }

  *findServices(filter) {
    yield* objectFilter(types.service, this._services, filter);
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const service of this._services) {
        service._traverse(...args);
      }

      return true;
    }
    return false;
  }

  typeNamed(typeName, name) {
    if (typeName === "service") {
      const service = this.services.find(s => s.name === name);
      if (service) {
        return service;
      }
    }

    return super.typeNamed(typeName, name);
  }

  named(name) {
    const service = this.services.find(s => s.name === name);
    if (service) {
      return service;
    }
  }
}
