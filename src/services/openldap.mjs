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
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    base: string_attribute_writable,
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

    const packageData = {
      sources: [
        ...this.templateContent(entryProperties, directoryProperties),
        new FileContentProvider(dir + "/", entryProperties, directoryProperties)
      ],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.location.name}-${this.host.name}`,
        description: `${this.typeName} definitions for ${this.fullName}@${this.host.name}`,
        access: "private",
        dependencies: ["openldap>=2.6.10"]
      }
    };

    yield packageData;
  }
}
