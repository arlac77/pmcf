import { join } from "node:path";
import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import { FileContentProvider } from "npm-pkgbuild";
import { boolean_attribute_writable_true } from "pacc";
import { Service, addType } from "pmcf";
import {
  writeLines,
  setionLinesFromPropertyIterator,
  filterConfigurable
} from "../utils.mjs";

export class influxdb extends Service {
  static attributes = {
    metricsDisabled: {
      ...boolean_attribute_writable_true,
      name: "metricsDisabled",
      externalName: "metrics-disabled",
      configurable: true
    }
  };
  static service = {
    endpoints: [
      {
        family: FAMILY_IPV4,
        port: 8086,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      },
      {
        family: FAMILY_IPV6,
        port: 8086,
        protocol: "tcp",
        tls: false,
        pathname: "/"
      }
    ]
  };

  static {
    addType(this);
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
