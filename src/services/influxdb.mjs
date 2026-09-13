import { join } from "node:path";
import { stringify } from "yaml";
import { boolean_attribute_writable_true } from "pacc";
import { CoreService, addType } from "pmcf";
import { writeLines, filterConfigurable } from "../utils.mjs";
import { FAMILY_IPV4_IPV6, PROTOCOL_TCP } from "../constants.mjs";

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
        protocol: PROTOCOL_TCP,
        tls: false,
        pathname: "/"
      }
    ]
  };

  static {
    addType(this);
  }

  async *preparePackages(dir) {
    const packageData = await this.preparePackage(dir);

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
