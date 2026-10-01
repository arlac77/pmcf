import { join } from "node:path";
import { port_attribute, string_attribute_writable } from "pacc";
import { CoreService, addType } from "pmcf";
import {
  writeLines,
  setionLinesFromAttributeIterator,
} from "../utils.mjs";
import { SOURCES_THIS_EXTENDS } from "../common-attributes.mjs";

const SCOPE_MOSQUITTO = "mosquitto";

export class mosquitto extends CoreService {
  static attributes = {
    listener: {
      ...port_attribute,
      name: "listener",
      writable: true,
      configurable: true,
      scope: SCOPE_MOSQUITTO
      // alias port
      // endpoints[type='mqtt']/port
    },
    persistence_location: {
      ...string_attribute_writable,
      name: "persistence_location",
      scope: SCOPE_MOSQUITTO,
      sources: SOURCES_THIS_EXTENDS
    },
    password_file: {
      ...string_attribute_writable,
      name: "password_file",
      scope: SCOPE_MOSQUITTO,
      sources: SOURCES_THIS_EXTENDS
    },
    acl_file: {
      ...string_attribute_writable,
      name: "acl_file",
      scope: SCOPE_MOSQUITTO,
      sources: SOURCES_THIS_EXTENDS
    }
  };
  static service = {
    extends: ["mqtt"]
  };

  static {
    addType(this);
  }

  set listener(value) {
    this.port = value;
  }

  get listener() {
    return this.port;
  }

  async *preparePackages(dir) {
    const packageData = await this.preparePackage(dir);

    await writeLines(
      join(dir, "etc", "mosquitto"),
      "mosquitto.conf",
      setionLinesFromAttributeIterator(
        this.attributeIterator(attribute => attribute.scope === SCOPE_MOSQUITTO),
        " "
      )
    );

    yield packageData;
  }
}
