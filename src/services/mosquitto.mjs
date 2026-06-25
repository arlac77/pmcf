import { port_attribute, string_attribute_writable } from "pacc";
import { Service, addType } from "pmcf";

export class mosquitto extends Service {
  static specializationOf = Service;
  static attributes = {
    listener: {
      ...port_attribute,
      name: "listener",
      writable: true,
      configurable: true
    },
    persistence_location: {
      ...string_attribute_writable,
      name: "persistence_location",
      configurable: true
    },
    password_file: {
      ...string_attribute_writable,
      name: "password_file",
      configurable: true
    },
    acl_file: {
      ...string_attribute_writable,
      name: "acl_file",
      configurable: true
    }
  };
  static service = {
    extends: ["mqtt"]
  };

  static {
    addType(this);
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
