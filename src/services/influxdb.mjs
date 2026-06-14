import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { boolean_attribute_writable_true, addType } from "pacc";
import { addServiceType } from "pmcf";
import {
  writeLines,
  setionLinesFromPropertyIterator,
  filterConfigurable
} from "../utils.mjs";
import { Service } from "../service.mjs";

export class influxdb extends Service {
  static specializationOf = Service;
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

  static {
    addType(this);
    addServiceType(this.service, this.name);
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
