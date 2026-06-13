import { FileContentProvider } from "npm-pkgbuild";
import { addType } from "pacc";
import { Owner } from "pmcf";
import { loadHooks } from "./hooks.mjs";

export class Location extends Owner {
  static name = "location";
  static owners = [Owner, Location, "root"];
  static attributes = {};

  static {
    addType(this);
  }

  get location() {
    return this;
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
