import { port_attribute, string_attribute_writable, addType } from "pacc";
import { addServiceType } from "pmcf";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const MosquittoServiceTypeDefinition = {
  name: "mosquitto",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
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
    const owner = "mosquitto";
    const group = "mosquitto";

    const packageData = this.packageData;
    packageData.sources = this.templateContent(
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
    );

    yield packageData;
  }
}
