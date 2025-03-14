import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { Owner } from "./owner.mjs";
import { addType } from "./types.mjs";
import { writeLines, sectionLines } from "./utils.mjs";

const LocationTypeDefinition = {
  name: "location",
  owners: [Owner.typeDefinition, "location", "root"],
  priority: 1.0,
  extends: Owner.typeDefinition,
  properties: {
    country: { type: "string", writeable: true },
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

  async *preparePackages(stagingDir) {
    await this.loadPackageHooks(
      new URL("location.install", import.meta.url).pathname
    );

    for await (const result of super.preparePackages(stagingDir)) {
      await writeLines(
        join(stagingDir, "etc/systemd/resolved.conf.d"),
        `${this.name}.conf`,
        sectionLines(...this.dns.systemdConfig)
      );

      await writeLines(
        join(stagingDir, "etc/systemd/journald.conf.d"),
        `${this.name}.conf`,
        sectionLines("Journal", {
          Compress: "yes",
          SystemMaxUse: "500M",
          SyncIntervalSec: "15m"
        })
      );

      await writeLines(
        join(stagingDir, "etc/systemd/timesyncd.conf.d"),
        `${this.name}.conf`,
        sectionLines(...this.ntp.systemdConfig)
      );

      const locationDir = join(stagingDir, "etc", "location");

      await mkdir(locationDir, { recursive: true });

      await copyFile(
        join(this.directory, "location.json"),
        join(locationDir, "location.json")
      );

      result.properties.name = `${this.typeName}-${this.name}`;

      result.properties.provides = ["location", "mf-location"];
      result.properties.depends = { jq: ">=1.6" };
      result.properties.replaces = [`mf-location-${this.name}`];

      result.sources.push(
        new FileContentProvider(stagingDir + "/")[Symbol.asyncIterator]()
      );

      result.properties.hooks = this.packageHooks;

      yield result;
    }
  }
}
