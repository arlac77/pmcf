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

export class InfluxdbService extends Service {
  static name = "influxdb";
  static priority = 1;
  static extends = ServiceTypeDefinition;
  static specializationOf = ServiceTypeDefinition;
  static owners = ServiceTypeDefinition.owners;
  static key = "name";
  static attributes = {
    metricsDisabled: {
      externalName: "metrics-disabled",
      ...boolean_attribute_writable_true,
      configurable: true
    }
  };
  static service = {
    endpoints: [
      {
        family: "IPv4",
        port: 8086,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      },
      {
        family: "IPv6",
        port: 8086,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      }
    ]
  };

  static typeDefinition = this;
  static {
    addType(this);
    addServiceType(this.service, this.name);
  }

  get type() {
    return this.constructor.name;
  }

  async *preparePackages(dir) {
    const packageData = this.packageData;

    packageData.sources.push(new FileContentProvider(dir + "/"));

    await writeLines(
      join(dir, "etc", "influxdb"),
      "config.yml",
      setionLinesFromPropertyIterator(
        this.attributeIterator(filterConfigurable)
      )
    );

    yield packageData;
  }
}
