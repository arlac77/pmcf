import { Base, Service } from "pmcf";

export class ServiceOwner extends Base {
  _services = new Map();

  set services(service) {
    this._services.set(service.name, service);
  }

  get services() {
    return this.mapFromDirections(["this", "extends"], "_services");
  }

  addObject(object)
  {
    if(object instanceof Service) {
      this._services.set(object.name, object);
    }

    super.addObject(object);
  }

  _materializeExtends() {
    super.materializeExtends();

    for (const serviceOwner of this.walkDirections(["extends"])) {
      /*console.log(
        "ServiceOwner materializeExtends",
        this.fullName,
        serviceOwner.fullName
      );*/

      for (const service of serviceOwner.services.values()) {
        const present = this.services.get(service.name);

        if (present) {
          //console.log("LINK SERVICE", this.fullName, present.fullName, service.fullName);
          present.extends.add(service);
        } else {
          //console.log("ADD  SERVICE", this.fullName, service.fullName);

          const s = service.forOwner(this);
          this._services.set(s.name, s);
        }
      }
    }
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const service of this._services.values()) {
        service._traverse(...args);
      }

      return true;
    }
    return false;
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
