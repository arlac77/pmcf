import { join } from "node:path";
import { writeLines, sectionLines } from "../utils.mjs";
import { addType } from "../type.mjs";
import { NetworkAddress, cidrAddresses } from "pmcf";
import { Interface } from "./interface.mjs";

/**
 *
 */
export class SkeletonNetworkInterface extends Interface {
  static get typeName() {
    return "network_interface";
  }

  static {
    addType(this);
  }

  _network;

  get network() {
    return this.attribute("_network") ?? this.host?.network;
  }

  set network(network) {
    this._network = network;
  }

  get subnets() {
    return new Map(
      [...new Set(this.ipAddresses.values())].map(s => [s.name, s])
    );
  }

  get ipAddresses() {
    return new Map();
  }

  /**
   *
   * @param {Object} filter
   * @return {Iterable<NetworkAddress>}
   */
  *networkAddresses(filter = n => true) {
    for (const [address, subnet] of this.ipAddresses) {
      const networkAddress = new NetworkAddress(this, address, subnet);

      if (filter(networkAddress)) {
        yield networkAddress;
      }
    }
  }

  networkAddress(filter) {
    for (const a of this.networkAddresses(filter)) {
      return a;
    }
  }

  get address() {
    return this.addresses[0];
  }

  get addresses() {
    return [...this.ipAddresses].map(([address]) => address);
  }

  async systemdDefinitions(dir) {
    const networkDir = join(dir, "etc/systemd/network");

    if (this.name !== "eth0" && this.hwaddr) {
      await writeLines(networkDir, `${this.name}.link`, [
        sectionLines("Match", { MACAddress: this.hwaddr }),
        "",
        sectionLines("Link", { Name: this.name })
      ]);
    }

    const networkSections = [sectionLines("Match", { Name: this.name })];

    for (const Address of cidrAddresses(this.networkAddresses())) {
      networkSections.push(
        "",
        sectionLines("Address", {
          Address
        })
      );
    }
  }
}
