import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { port_attribute, string_attribute_writable } from "pacc";
import { CoreService, addType } from "pmcf";
import {
  writeLines,
  setionLinesFromAttributeIterator,
  filterConfigurable
} from "../utils.mjs";

export class mosquitto extends CoreService {
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
    console.log(
      "MOSQUITTO",
      [...this.walkDirections(["extends"])].map(n => this.fullName)
    );
    const permissions = this.packageContentPermissions;
    const packageData = this.packageData;

    packageData.sources = await Array.fromAsync(
      this.templateContent(...permissions)
    );

    packageData.sources.push(
      new FileContentProvider(dir + "/", ...permissions)
    );

    await writeLines(
      join(dir, "etc", "mosquitto"),
      "mosquitto.conf",
      setionLinesFromAttributeIterator(
        this.attributeIterator(filterConfigurable),
        " "
      )
    );

    yield packageData;
  }
}
