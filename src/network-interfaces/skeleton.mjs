import { join } from "node:path";
import { writeLines, sectionLines } from "../utils.mjs";
import { NetworkAddress, Host, cidrAddresses } from "pmcf";
import { ServiceOwner } from "../service-owner.mjs";

/**
 * 
 */
export class SkeletonNetworkInterface extends ServiceOwner {
  _network;

  static get typeName() {
    return "network_interface";
  }

  get typeName() {
    return "network_interface";
  }

  get host() {
    if (this.owner instanceof Host) {
      return this.owner;
    }
  }

  *hosts() {
    const host = this.host;
    if (host) {
      yield host;
    }
  }

  get network_interface() {
    return this;
  }

  get domainName() {
    return this.host?.domainName;
  }

  get domainNames() {
    return new Set();
  }

  matches(other) {
    if (this.isTemplate) {
      const name = this.name.replaceAll("*", "");
      return name.length === 0 || other.name.indexOf(name) >= 0;
    }

    return false;
  }

  get network() {
    return this.extendedAttribute("_network") ?? this.host?.network;
  }

  set network(network) {
    this._network = network;
  }

  *subnets() {
    yield* this.ipAddresses.values();
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
