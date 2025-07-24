import { FileContentProvider } from "npm-pkgbuild";
import { default_attribute } from "pacc";
import { Owner } from "pmcf";
import { addType } from "./types.mjs";
import { loadHooks } from "./hooks.mjs";

const LocationTypeDefinition = {
  name: "location",
  owners: [Owner.typeDefinition, "location", "root"],
  priority: 1.0,
  extends: Owner.typeDefinition,
  properties: {
    locales: { ...default_attribute, collection: true, writeable: true }
  }
};

export class Location extends Owner {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return LocationTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, LocationTypeDefinition);
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
      dir,
      sources: [
        new FileContentProvider(dir + "/"),
        new FileContentProvider(
          { base: this.directory, pattern: "location.json" },
          { destination: "/etc/location/location.json" }
        )
      ],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.name}`,
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private",
        dependencies: { jq: ">=1.6" },
        provides: ["location", "mf-location"],
        replaces: [`mf-location-${this.name}`],
        hooks: await loadHooks(
          {},
          new URL("location.install", import.meta.url).pathname
        )
      }
    };

    yield packageData;
  }
}
