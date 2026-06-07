import { Base, Service } from "pmcf";

export class ServiceOwner extends Base {
  _services = new Map();

  set services(service) {
    this._services.set(service.name, service);
  }

  get services() {
    return this._services;
    //return this.mapFromDirections(["this", "extends"], "_services");
  }

  addObject(object) {
    if (object instanceof Service) {
      this._services.set(object.name, object);
    }

    super.addObject(object);
  }

  materializeExtends() {
    super.materializeExtends();

    for (const [name, service] of this.mapFromDirections(
      ["extends"],
      "_services"
    )) {
      const present = this._services.get(service.name);

      if (present) {
        //console.log("LINK SERVICE", this.fullName, present.fullName, service.fullName);
        present.extends.add(service);
      } else {
        //console.log("ADD  SERVICE", this.fullName, service.fullName);
        this.services = service.forOwner(this);
      }
    }

    /*
    if (this.fullName === "/SW/mini1") {
      const myServiceNames = new Set([...this.services.keys()]);
      const extendingSericeNames = new Set([
        ...this.mapFromDirections(["extends"], "_services").keys()
      ]);

      console.log("XXX",this.fullName, [...this.extends].map(n=>n.fullName), myServiceNames, extendingSericeNames);

      if (!extendingSericeNames.isSubsetOf(myServiceNames)) {
        // const diff = myServiceNames.difference(extendingSericeNames);
        console.log(
          "DIFF",
          this.fullName,
          myServiceNames,
          extendingSericeNames
        );
      }
    }
    */
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
