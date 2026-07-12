import { string_attribute_writable } from "pacc";
import { CoreService, addType } from "pmcf";

export class openldap extends CoreService {
  static attributes = {
    base: { ...string_attribute_writable, name: "base" },
    uri: { ...string_attribute_writable, name: "uri" }
  };
  static service = {
    systemdService: "slapd.service",
    extends: ["ldap", "ldapi"]
  };

  static {
    addType(this);
  }

  _base;

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

  get systemUserName() {
    return "ldap";
  }

  get systemGroupName() {
    return "ldap";
  }

  async *preparePackages(dir) {
    const permissions = this.packageContentPermissions;
    const packageData = this.packageData;

    packageData.sources = await Array.fromAsync(
      this.templateContent(...permissions)
    );

    yield packageData;
  }
}
