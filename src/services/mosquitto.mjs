import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { boolean_attribute_writable_true } from "pacc";
import { writeLines } from "../utils.mjs";
import { addType } from "../types.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const MosquittoServiceTypeDefinition = {
  name: "mosquitto",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  priority: 0.1,
  key: "name",
  attributes: {
    log_timestamp: {
      ...boolean_attribute_writable_true,
      isCommonOption: true
    },
    allow_anonymous: {
      ...boolean_attribute_writable_true,
      isCommonOption: true
    }
  },
  service: {
    extends: ["mqtt"]
  }
};

export class MosquittoService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return MosquittoServiceTypeDefinition;
  }

  get type() {
    return MosquittoServiceTypeDefinition.name;
  }

  async *preparePackages(dir) {
    const network = this.network;
    const host = this.host;
    const name = host.name;

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `mosquitto-${this.location.name}-${host.name}`,
        description: `mosquitto definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["mosquitto>=2.0.22"]
      }
    };

    const lines = Object.entries(MosquittoServiceTypeDefinition.attributes)
      .filter(
        ([key, attribute]) =>
          attribute.isCommonOption && this[key] !== undefined
      )
      .map(([key]) => `${key}: ${this[key]}`);

    const endpoint = this.endpoint("mqtt");

    lines.push(
      `listener ${endpoint.port}`,
      "persistence_location /var/lib/mosquitto",
      "password_file /etc/mosquitto/passwd",
      "acl_file /etc/mosquitto/acl"
    );

    await writeLines(join(dir, "etc", "mosquitto"), "mosquitto.conf", lines);

    yield packageData;
  }
}
