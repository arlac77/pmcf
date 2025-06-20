import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { addType } from "../types.mjs";
import { ServiceTypeDefinition, Service } from "../service.mjs";
import { writeLines } from "../utils.mjs";

const OpenLDAPServiceTypeDefinition = {
  name: "openldap",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {
    baseDN: {
      type: "string",
      collection: false,
      writeable: true
    },
    rootDN: {
      type: "string",
      collection: false,
      writeable: true
    },
    uri: {
      type: "string",
      collection: false,
      writeable: true
    }
  },
  service: {}
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
    this.read(data, OpenLDAPServiceTypeDefinition);
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

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `openldap-${this.location.name}-${name}`,
        description: `openldap definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["openldap>=2.6.10"]
      }
    };

    await writeLines(join(packageData.dir, "etc/conf.d"), "slapd", [
      "SLAPD_OPTIONS=-d 9",
      "SLAPD_URLS=ldap:/// ldaps:///"
    ]);

    await writeLines(join(packageData.dir, "etc/openldap"), "ldap.conf", [
      `BASE=${this.baseDN}`,
      `URI=${this.uri}`
    ]);

    yield packageData;
  }
}
