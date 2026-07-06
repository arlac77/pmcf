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
