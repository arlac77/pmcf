import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { string_attribute_writable, addType } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";
import { writeLines } from "../utils.mjs";
import { addHook } from "../hooks.mjs";

const OpenLDAPServiceTypeDefinition = {
  name: "openldap",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    baseDN: string_attribute_writable,
    rootDN: string_attribute_writable,
    uri: string_attribute_writable
  },
  service: {
    extends: ["ldap"],
    services: {
      ldap: {
        endpoints: [
          {
            family: "unix",
            path: "/run/ldapi"
          }
        ]
      }
    }
  }
};

export class OpenLDAPService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return OpenLDAPServiceTypeDefinition;
  }

  _baseDN;
  _rootDN;

  constructor(owner, data) {
    super(owner, data);
    this._systemd = "slapd.service";
  }

  get type() {
    return OpenLDAPServiceTypeDefinition.name;
  }

  get baseDN() {
    return this.expand(this._baseDN);
  }

  set baseDN(value) {
    this._baseDN = value;
  }

  get rootDN() {
    return this.expand(this._rootDN);
  }

  set rootDN(value) {
    this._rootDN = value;
  }

  get uri() {
    return this._uri;
  }

  set uri(value) {
    this._uri = value;
  }

  async *preparePackages(dir) {
    const host = this.host;
    const name = host.name;
    const owner = "ldap";
    const group = "ldap";

    const packageData = {
      dir,
      sources: [
        new FileContentProvider(
          dir + "/",
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
      ],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.location.name}-${name}`,
        description: `${this.typeName} definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["openldap>=2.6.10"],
        hooks: {}
      }
    };

    addHook(
      packageData.properties.hooks,
      "post_upgrade",
      `setfacl -m u:${owner}:r /etc/letsencrypt/archive/*/privkey*.pem`
    );

    addHook(
      packageData.properties.hooks,
      "post_install",
      `setfacl -m u:${owner}:r /etc/letsencrypt/archive/*/privkey*.pem`
    );

    await writeLines(
      join(packageData.dir, "etc/conf.d"),
      "slapd",
      this.expand([
        "SLAPD_OPTIONS=",
        "SLAPD_URLS=ldap:/// ldaps:/// ldapi://%2Frun%2Fldapi"
      ])
    );

    await writeLines(
      join(packageData.dir, "/var/lib/openldap/openldap-data"),
      "DB_CONFIG",
      this.expand([
        "set_cachesize 0 16777216 1",
        "set_lg_regionmax 65536",
        "set_lg_bsize 524288"
      ])
    );

    await writeLines(
      join(packageData.dir, "etc/openldap"),
      "ldap.conf",
      this.expand([`BASE  ${this.baseDN}`, `URI   ${this.uri}`])
    );

    yield packageData;
  }
}
