import { join } from "node:path";
import { stringify } from "yaml";
import { FileContentProvider } from "npm-pkgbuild";
import { boolean_attribute_writable_true } from "pacc";
import { CoreService, addType, FAMILY_IPV4_IPV6 } from "pmcf";
import { writeLines, filterConfigurable } from "../utils.mjs";

export class influxdb extends CoreService {
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
        family: FAMILY_IPV4_IPV6,
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
      stringify(
        Object.fromEntries(
          [...this.attributeIterator(filterConfigurable)].map(
            ([name, value, path, attribute]) => [attribute.externalName, value]
          )
        )
      )
    );

    yield packageData;
  }
}
