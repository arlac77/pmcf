import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { boolean_attribute_writable_true, addType } from "pacc";
import { addServiceType } from "pmcf";
import {
  writeLines,
  setionLinesFromPropertyIterator,
  filterConfigurable
} from "../utils.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const InfluxdbServiceTypeDefinition = {
  name: "influxdb",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {
    "metricsDisabled": {
      externalName: "metrics-disabled",
      ...boolean_attribute_writable_true,
      configurable: true
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
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return InfluxdbServiceTypeDefinition;
  }

  get type() {
    return InfluxdbServiceTypeDefinition.name;
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
        dependencies: ["influxdb>=2.7.0"]
      }
    };

    await writeLines(
      join(dir, "etc", "influxdb"),
      "config.yml",
      setionLinesFromPropertyIterator(this.propertyIterator(filterConfigurable))
    );

    yield packageData;
  }
}
