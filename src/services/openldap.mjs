import { FileContentProvider } from "npm-pkgbuild";
import {
  string_attribute_writable,
  number_attribute_writable,
  object_attribute,
  addType
} from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const OpenLDAPServiceTypeDefinition = {
  name: "openldap",
  priority: 1,
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    base: string_attribute_writable,
    uri: string_attribute_writable
  },
  service: {
    systemdService: "slapd.service",
    extends: ["ldap", "ldapi"],
    services: {}
  }
};

export class OpenLDAPService extends Service {
  static typeDefinition = OpenLDAPServiceTypeDefinition;
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  _base;

  get type() {
    return OpenLDAPServiceTypeDefinition.name;
  }

  get base() {
    return this.extendedAttribute("_base");
  }

  set base(value) {
    this._base = value;
  }

  get uri() {
    return this.extendedAttribute("_uri");
  }

  set uri(value) {
    this._uri = value;
  }

  async *preparePackages(dir) {
    const owner = "ldap";
    const group = "ldap";

    const packageData = this.packageData;

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
