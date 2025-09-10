import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { string_attribute } from "pacc";
import { addType } from "../types.mjs";
import { ServiceTypeDefinition, Service } from "../service.mjs";
import { writeLines } from "../utils.mjs";
import { addHook } from "../hooks.mjs";

const OpenLDAPServiceTypeDefinition = {
  name: "openldap",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {
    baseDN: {
      ...string_attribute,
      writable: true
    },
    rootDN: {
      ...string_attribute,
      writable: true
    },
    uri: {
      ...string_attribute,
      writable: true
    }
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
    const network = this.network;
    const host = this.host;
    const name = host.name;

    console.log("openldap", name, network.name);

    const filePermissions = [
      {
        mode: 0o644,
        owner: "ldap",
        group: "ldap"
      },
      {
        mode: 0o755,
        owner: "ldap",
        group: "ldap"
      }
    ];

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/", ...filePermissions)],
      outputs: this.outputs,
      properties: {
        name: `openldap-${this.location.name}-${name}`,
        description: `openldap definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["openldap>=2.6.10"],
        hooks: {}
      }
    };

    addHook(
      packageData.properties.hooks,
      "post_upgrade",
      "setfacl -m u:ldap:r /etc/letsencrypt/archive/*/privkey*.pem"
    );

    addHook(
      packageData.properties.hooks,
      "post_install",
      "setfacl -m u:ldap:r /etc/letsencrypt/archive/*/privkey*.pem"
    );

    await writeLines(join(packageData.dir, "etc/conf.d"), "slapd", [
      "SLAPD_OPTIONS=",
      "SLAPD_URLS=ldap:/// ldaps:/// ldapi://%2Frun%2Fldapi"
    ]);

    await writeLines(
      join(packageData.dir, "/var/lib/openldap/openldap-data"),
      "DB_CONFIG",
      [
        "set_cachesize 0 16777216 1",
        "set_lg_regionmax 65536",
        "set_lg_bsize 524288"
      ]
    );

    await writeLines(join(packageData.dir, "etc/openldap"), "ldap.conf", [
      `BASE  ${this.baseDN}`,
      `URI   ${this.uri}`
    ]);

    yield packageData;
  }
}
