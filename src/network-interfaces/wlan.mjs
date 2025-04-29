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

    /*
    writeFile(
      join(d, `${this.network.name}.psk`),
      `[Security]
Passphrase=
SAE-PT-Group19=
SAE-PT-Group20=
`,
      "utf8"
    );
*/
    /*
    const d = join(packageData.dir, "etc/wpa_supplicant");
    await mkdir(d, { recursive: true });
    writeFile(
      join(d, `wpa_supplicant-${this.name}.conf`),
      `country=${this.location.country}
ctrl_interface=DIR=/run/wpa_supplicant GROUP=netdev
update_config=1
p2p_disabled=1
network={
  ssid="${this.ssid}"
  psk=${this.psk}
  scan_ssid=1
}`,
      "utf8"
    );

    addHook(
      packageData.properties.hooks,
      "post_install",
      `systemctl enable wpa_supplicant@${this.name}.service`
    );

  */
  }
}
