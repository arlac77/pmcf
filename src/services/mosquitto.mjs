import { port_attribute, string_attribute_writable, addType } from "pacc";
import { addServiceType } from "pmcf";
import { Service, ServiceTypeDefinition } from "../service.mjs";

export class MosquittoService extends Service {
  static name = "mosquitto";
  static priority = 1;
  static extends = ServiceTypeDefinition;
  static specializationOf = ServiceTypeDefinition;
  static owners = ServiceTypeDefinition.owners;
  static key = "name";
  static attributes = {
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
  };
  static service = {
    extends: ["mqtt"]
  };
  static typeDefinition = this;
  static {
    addType(this);
    addServiceType(this.service, this.name);
  }

  get type() {
    return this.constructor.name;
  }

  get listener() {
    return this.endpoint("mqtt").port;
  }

  async *preparePackages(dir) {
    const owner = "mosquitto";
    const group = "mosquitto";

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
