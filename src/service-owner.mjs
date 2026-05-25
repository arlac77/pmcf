import { Base, Service } from "pmcf";

export class ServiceOwner extends Base {
  services = [];

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
          //console.log("LINK", present.fullName, service.fullName);
          present.extends.push(service);
        } else {
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
