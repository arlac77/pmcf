import { Base } from "pmcf";

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
    const services = filter
      ? this.expression(`services[${filter}]`)
      : this.services;

    for (const service of services) {
      yield service;
    }
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

    if (typeName === "number") {
      throw new Error("invalidType");
    }
    //console.log("TN***",typeName, name);
    return super.typeNamed(typeName, name);
  }

  named(name) {
    const service = this.services.find(s => s.name === name);
    if (service) {
      return service;
    }
  }
}
