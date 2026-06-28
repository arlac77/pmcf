import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { string_attribute_writable, addType } from "pacc";
import { writeLines, sectionLines } from "../utils.mjs";
import { psk_attribute, ssid_attribute } from "../common-attributes.mjs";
import { NetworkInterface } from "./network-interface.mjs";
import { ethernet } from "./ethernet.mjs";

export class wlan extends ethernet {
  static specializationOf = NetworkInterface;
  static attributes = {
    ssid: ssid_attribute,
    psk: psk_attribute,
    secretName: { ...string_attribute_writable, name: "secretName" }
  };

  static {
    addType(this);
  }

  static isCommonName(name) {
    return name.match(/^wlan\d+$/);
  }

  _ssid;
  _psk;
  _secretName;

  set secretName(value) {
    this._secretName = value;
  }

  get secretName() {
    return (
      this.attribute("_secretName") ??
      this.network?.secretName ??
      `${this.network.name}.password`
    );
  }

  set ssid(value) {
    this._ssid = value;
  }

  get ssid() {
    return this.attribute("_ssid") ?? this.network?.ssid;
  }

  set psk(value) {
    this._psk = value;
  }

  get psk() {
    return this.attribute("_psk") ?? this.network?.psk;
  }

  async systemdDefinitions(dir, packageData) {
    await super.systemdDefinitions(dir, packageData);
    await mkdir(join(dir, "var/lib/iwd/"), { recursive: true });

    const secretName = this.secretName;

    await writeLines(join(dir, "/etc/iwd"), "main.conf", [
      sectionLines("General", {
        SystemdEncrypt: secretName
      })
    ]);

    await writeLines(
      join(dir, "usr/lib/systemd/system/iwd.service.d/"),
      "pmcf.conf",
      [
        sectionLines("Service", {
          LoadCredentialEncrypted: `${secretName}:/etc/credstore.encrypted/${secretName}`
        })
      ]
    );

    packageData.properties.optional.push("iwd", "impala");
  }
}
