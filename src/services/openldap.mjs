import { string_attribute_writable, addType } from "pacc";
import { addServiceType } from "pmcf";
import { Service } from "../service.mjs";

export class openldap extends Service {
  static specializationOf = Service;
  static attributes = {
    base: string_attribute_writable,
    uri: string_attribute_writable
  };
  static service = {
    systemdService: "slapd.service",
    extends: ["ldap", "ldapi"],
    services: {}
  };

  static {
    addType(this);
    addServiceType(this.service, this.name);
  }

  _base;

  get type() {
    return this.constructor.name;
  }

  get base() {
    return this.attribute("_base");
  }

  set base(value) {
    this._base = value;
  }

  get uri() {
    return this.attribute("_uri");
  }

  set uri(value) {
    this._uri = value;
  }

  async *preparePackages(dir) {
    const owner = "ldap";
    const group = "ldap";

    const packageData = this.packageData;

    console.log([...this.walkDirections(["this", "extends"]) ].map(n=>n.fullName));

    packageData.sources = await Array.fromAsync(
      this.templateContent(
        {
          mode: 0o644,
          owner,
          group
        },
        {
          mode: 0o755,
          owner,
          group
        }
      )
    );

    yield packageData;
  }
}
