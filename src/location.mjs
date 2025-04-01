import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";
import { writeLines, sectionLines } from "./utils.mjs";
import { loadHooks } from "./hooks.mjs";

const LocationTypeDefinition = {
  name: "location",
  owners: [Owner.typeDefinition, "location", "root"],
  priority: 1.0,
  extends: Owner.typeDefinition,
  properties: {
    locales: { type: "string", collection: true, writeable: true }
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
      sources: [new FileContentProvider(dir + "/")[Symbol.asyncIterator]()],
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

    await writeLines(
      join(dir, "etc/systemd/resolved.conf.d"),
      `${this.name}.conf`,
      sectionLines(...this.findService({ type: "dns" }).systemdConfig)
    );

    await writeLines(
      join(dir, "etc/systemd/journald.conf.d"),
      `${this.name}.conf`,
      sectionLines("Journal", {
        Compress: "yes",
        SystemMaxUse: "500M",
        SyncIntervalSec: "15m"
      })
    );

    await writeLines(
      join(dir, "etc/systemd/timesyncd.conf.d"),
      `${this.name}.conf`,
      sectionLines(...this.findService({ type: "ntp" }).systemdConfig)
    );

    const locationDir = join(dir, "etc", "location");

    await mkdir(locationDir, { recursive: true });

    await copyFile(
      join(this.directory, "location.json"),
      join(locationDir, "location.json")
    );

    yield packageData;
  }
}
