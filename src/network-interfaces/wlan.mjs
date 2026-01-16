import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  string_attribute_writable,
  secret_attribute_writable,
  addType
} from "pacc";
import { writeLines, sectionLines } from "../utils.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";
import {
  EthernetNetworkInterface,
  EthernetNetworkInterfaceTypeDefinition
} from "./ethernet.mjs";

const WLANNetworkInterfaceTypeDefinition = {
  name: "wlan",
  extends: EthernetNetworkInterfaceTypeDefinition,
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: EthernetNetworkInterfaceTypeDefinition.owners,
  key: "name",
  attributes: {
    ssid: string_attribute_writable,
    psk: secret_attribute_writable,
    secretName: string_attribute_writable
  }
};

export class WLANNetworkInterface extends EthernetNetworkInterface {
  _ssid;
  _psk;
  _secretName;

  static {
    addType(this);
  }

  static isCommonName(name) {
    return name.match(/^wlan\d+$/);
  }

  static get typeDefinition() {
    return WLANNetworkInterfaceTypeDefinition;
  }

  get kind() {
    return WLANNetworkInterfaceTypeDefinition.name;
  }

  set secretName(value) {
    this._secretName = value;
  }

  get secretName() {
    return (
      this.extendedAttribute("_secretName") ??
      this.network?.secretName ??
      `${this.network.name}.password`
    );
  }

  set ssid(value) {
    this._ssid = value;
  }

  get ssid() {
    return this.extendedAttribute("_ssid") ?? this.network?.ssid;
  }

  set psk(value) {
    this._psk = value;
  }

  get psk() {
    return this.extendedAttribute("_psk") ?? this.network?.psk;
  }

  async systemdDefinitions(packageData) {
    await super.systemdDefinitions(packageData);
    await mkdir(join(packageData.dir, "var/lib/iwd/"), { recursive: true });

    const secretName = this.secretName;

    await writeLines(join(packageData.dir, "/etc/iwd"), "main.conf", [
      sectionLines("General", {
        SystemdEncrypt: secretName
      })
    ]);

    await writeLines(
      join(packageData.dir, "usr/lib/systemd/system/iwd.service.d/"),
      "pmcf.conf",
      [
        sectionLines("Service", {
          LoadCredentialEncrypted: `${secretName}:/etc/credstore.encrypted/${secretName}`
        })
      ]
    );

    packageData.properties.requires.push("iwd", "impala");
  }
}
