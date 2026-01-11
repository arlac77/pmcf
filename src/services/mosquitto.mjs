import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import {
  boolean_attribute_writable_true,
  port_attribute,
  string_attribute_writable,
  addType
} from "pacc";
import { addServiceType } from "pmcf";
import { writeLines, filterConfigurable, setionLinesFromPropertyIterator } from "../utils.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const MosquittoServiceTypeDefinition = {
  name: "mosquitto",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    /*log_timestamp: {
      ...boolean_attribute_writable_true,
      configurable: true
    },
    allow_anonymous: {
      ...boolean_attribute_writable_true,
      configurable: true
    },*/
    listener: {
      ...port_attribute,
      writable: true,
      configurable: true
    },
    persistence_location: {
      ...string_attribute_writable,
      configurable: true
    },
    password_file: {
      ...string_attribute_writable,
      configurable: true
    },
    acl_file: {
      ...string_attribute_writable,
      configurable: true
    }
  },
  service: {
    extends: ["mqtt"]
  }
};

export class MosquittoService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return MosquittoServiceTypeDefinition;
  }

  get type() {
    return MosquittoServiceTypeDefinition.name;
  }

  get listener() {
    return this.endpoint("mqtt").port;
  }

  async *preparePackages(dir) {
    const host = this.host;
    const name = host.name;

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.location.name}-${host.name}`,
        description: `${this.typeName} definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["mosquitto>=2.0.22"]
      }
    };

    await writeLines(
      join(dir, "etc", "mosquitto"),
      "mosquitto.conf",
          setionLinesFromPropertyIterator(this.propertyIterator(filterConfigurable))
    );
    
    yield packageData;
  }
}
