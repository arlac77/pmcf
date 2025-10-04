import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { boolean_attribute_writable_true } from "pacc";
import { writeLines } from "../utils.mjs";
import { addType } from "../types.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const InfluxdbServiceTypeDefinition = {
  name: "influxdb",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    "metrics-disabled": {
      ...boolean_attribute_writable_true,
      isCommonOption: true
    }
  },
  service: {
    endpoints: [
      {
        family: "IPv4",
        port: 8086,
        protocol: "tcp",
        tls: false
      },
      {
        family: "IPv6",
        port: 8086,
        protocol: "tcp",
        tls: false
      }
    ]
  }
};

export class InfluxdbService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return InfluxdbServiceTypeDefinition;
  }

  get type() {
    return InfluxdbServiceTypeDefinition.name;
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
        name: `influxdb-${this.location.name}-${host.name}`,
        description: `influxdb definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["influxdb>=2.7.0"]
      }
    };

    const lines = Object.entries(InfluxdbServiceTypeDefinition.attributes)
      .filter(
        ([key, attribute]) =>
          attribute.isCommonOption && this[key] !== undefined
      )
      .map(([key]) => `${key}: ${this[key]}`);

    await writeLines(join(dir, "etc", "influxdb"), "config.yml", lines);

    yield packageData;
  }
}
