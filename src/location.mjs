import { FileContentProvider } from "npm-pkgbuild";
import { string_collection_attribute_writable, addType } from "pacc";
import { Owner } from "pmcf";
import { loadHooks } from "./hooks.mjs";

const LocationTypeDefinition = {
  name: "location",
  owners: [Owner.typeDefinition, "location", "root"],
  extends: Owner.typeDefinition,
  key: "name",
  attributes: {
    locales: string_collection_attribute_writable
  }
};

export class Location extends Owner {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return LocationTypeDefinition;
  }

  get location() {
    return this;
  }

  locationNamed(name) {
    if (this.isNamed(name)) {
      return this;
    }

    return super.locationNamed(name);
  }

  get network() {
    return [...this.typeList("network")][0] || super.network;
  }

  async *preparePackages(dir) {
    const packageData = {
      sources: [
        new FileContentProvider(dir + "/"),
        new FileContentProvider(
          { dir: this.directory, pattern: "location.json" },
          { destination: "/etc/location/location.json" }
        )
      ],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.name}`,
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private",
        dependencies: { jq: ">=1.6" },
        provides: ["location"]
      }
    };

    await loadHooks(
      packageData,
      new URL("location.install", import.meta.url).pathname
    );

    yield packageData;
  }
}
