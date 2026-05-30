import { Base, Service } from "pmcf";

export class ServiceOwner extends Base {
  services = [];

  get allServices()
  {
    return this._allServices();
  }

  *_allServices() {
    for (const node of this.walkDirections(["this", "extends"])) {
      yield* node.services;
    }
  }

  materializeExtends() {
    super.materializeExtends();

    for (const serviceOwner of this.walkDirections(["extends"])) {
      /*console.log(
        "ServiceOwner materializeExtends",
        this.fullName,
        serviceOwner.fullName
      );*/

      for (const service of serviceOwner.services) {
        const present = this.services.find(s => s.name === service.name);

        if (present) {
          //console.log("LINK SERVICE", this.fullName, present.fullName, service.fullName);
          present.extends.add(service);
        } else {
          //console.log("ADD  SERVICE", this.fullName, service.fullName);
          this.services.push(service.forOwner(this));
        }
      }

      /*for (const service of this.services) {
        service.materializeExtends();
      }*/
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
