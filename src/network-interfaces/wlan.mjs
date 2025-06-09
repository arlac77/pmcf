import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { addType } from "../types.mjs";
import { addHook } from "../hooks.mjs";
import { NetworkInterfaceTypeDefinition } from "./network-interface.mjs";
import {
  EthernetNetworkInterface,
  EthernetNetworkInterfaceTypeDefinition
} from "./ethernet.mjs";

const WLANNetworkInterfaceTypeDefinition = {
  name: "wlan",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: EthernetNetworkInterfaceTypeDefinition.owners,
  extends: EthernetNetworkInterfaceTypeDefinition,
  priority: 0.1,
  properties: {}
};

export class WLANNetworkInterface extends EthernetNetworkInterface {
  _ssid;
  _psk;

  static {
    addType(this);
  }

  static get typeDefinition() {
    return WLANNetworkInterfaceTypeDefinition;
  }

  get kind() {
    return WLANNetworkInterfaceTypeDefinition.name;
  }

  set ssid(value) {
    this._ssid = value;
  }

  get ssid() {
    return this.extendedProperty("_ssid") ?? this.network?.ssid;
  }

  set psk(value) {
    this._psk = value;
  }

  get psk() {
    return this.extendedProperty("_psk") ?? this.network?.psk;
  }

  async systemdDefinitions(packageData) {
    await super.systemdDefinitions(packageData);
    const d = join(packageData.dir, "var/lib/iwd/");
    await mkdir(d, { recursive: true });

    packageData.properties.requires.push("iwd", "impala");
  }
}
