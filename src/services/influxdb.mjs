import { join } from "node:path";
import { stringify } from "yaml";
import { boolean_attribute_writable_true, extract } from "pacc";
import { CoreService, addType } from "pmcf";
import { writeLines } from "../utils.mjs";
import { FAMILY_DNS_IPV4_IPV6, PROTOCOL_TCP } from "../constants.mjs";
import { SOURCES_THIS_EXTENDS } from "../common-attributes.mjs";

const SCOPE_INFLUXDB = "influxdb";

export class influxdb extends CoreService {
  static attributes = {
    metricsDisabled: {
      ...boolean_attribute_writable_true,
      name: "metricsDisabled",
      externalName: "metrics-disabled",
      scope: SCOPE_INFLUXDB,
      sources: SOURCES_THIS_EXTENDS
    }
  };
  static service = {
    endpoints: [
      {
        family: FAMILY_DNS_IPV4_IPV6,
        port: 8086,
        protocol: PROTOCOL_TCP,
        tls: false,
        scheme: "http"
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
        extract(this, {
          filter: attribute => attribute.scope === SCOPE_INFLUXDB,
          externalNames: true
        })
      )
    );

    yield packageData;
  }
}
