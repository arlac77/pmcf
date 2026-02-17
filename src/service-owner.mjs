import { Base, Service } from "pmcf";

export class ServiceOwner extends Base {
  services = [];

  _applyExtends(owner) {
    super._applyExtends(owner);

    for (const service of owner.services) {
      const present = this.services.find(s => s.name === service.name);

      if (present && service.isTemplate) {
        if (present.extends.indexOf(service) < 0) {
          present._applyExtends(service);
          present.extends.push(service);
        }
      } else {
        this.services.push(service.forOwner(this));
      }
    }
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const service of this.services) {
        service._traverse(...args);
      }

      return true;
    }
    return false;
  }

  *findServices(filter) {
    const services = filter
      ? this.expression(`services[${filter}]`)
      : this.services;

    for (const service of services) {
      yield service;
    }
  }

  typeNamed(typeName, name) {
    if (typeName === "service") {
      const service = this.services.find(s => s.name === name);
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
    return this.services.find(s => s.name === name);
  }
}
