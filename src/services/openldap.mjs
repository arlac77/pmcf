import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import {
  string_attribute_writable,
  number_attribute_writable,
  object_attribute,
  addType
} from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";
import { writeLines, filterConfigurable } from "../utils.mjs";
import { addHook } from "../hooks.mjs";
import { createExpressionTransformer } from "content-entry-transform";

const OpenLDAPServiceTypeDefinition = {
  name: "openldap",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    baseDN: string_attribute_writable,
    rootDN: string_attribute_writable,
    uri: string_attribute_writable,

    DB_CONFIG: {
      ...object_attribute,
      attributes: {
        set_cachesize: {
          ...string_attribute_writable,
          configurable: true,
          default: "0 16777216 1"
        },
        set_lg_regionmax: {
          ...number_attribute_writable,
          configurable: true,
          default: 65536
        },
        set_lg_bsize: {
          ...number_attribute_writable,
          configurable: true,
          default: 524288
        },
        txn_checkpoint: {
          ...string_attribute_writable,
          configurable: true
        }
      }
    }
  },
  service: {
    systemdService: "slapd.service",
    extends: ["ldap", "ldapi"],
    services: {}
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

  DB_CONFIG = {};
  _baseDN;
  _rootDN;

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

    const entryProperties = {
      mode: 0o644,
      owner,
      group
    };
    const directoryProperties = {
      mode: 0o755,
      owner,
      group
    };
    const transformers = [
      createExpressionTransformer(e => true, { base: "ABC123" })
    ];

    const templateDirs = [];
    for (const e of [...this.allExtends(), this]) {
      const base = join(e.directory, "content") + "/";
      console.log("TEMPLATE", e.fullName, base);
      templateDirs.push(
        new FileContentProvider(
          { transformers, base },
          entryProperties,
          directoryProperties
        )
      );
    }

    const packageData = {
      dir,
      sources: [
        ...templateDirs,
        new FileContentProvider(dir + "/", entryProperties, directoryProperties)
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

      /*
      ...[...this.propertyIterator(filterConfigurable)].map(
        ([name, value]) => `${name} ${value}`
      )
    */

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
