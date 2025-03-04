import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
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

  async preparePackage(stagingDir) {
    const { properties } = await super.preparePackage(stagingDir);

    await writeLines(
      join(stagingDir, "etc/systemd/resolved.conf.d"),
      `${this.name}.conf`,
      sectionLines("Resolve", await this.dns.resolvedConfig())
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
      sectionLines("Time", {
        NTP: this.ntp.servers.join(" "),
        PollIntervalMinSec: 60,
        SaveIntervalSec: 3600
      })
    );

    const locationDir = join(stagingDir, "etc", "location");

    await mkdir(locationDir, { recursive: true });

    await copyFile(
      join(this.directory, "location.json"),
      join(locationDir, "location.json")
    );

    properties.provides = [
      "location",
      "mf-location",
      `mf-location-${this.name}`
    ];
    properties.replaces = [`mf-location-${this.name}`];

    const install = "location.install";

	  console.log(
      new URL(install, import.meta.url));

    await copyFile(
      new URL(install, import.meta.url),
      join(stagingDir, install)
    );

    properties.install = install;

    return { properties };
  }
}
