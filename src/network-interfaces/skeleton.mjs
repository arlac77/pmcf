import { join } from "node:path";
import { AggregatedMap } from "aggregated-map";
import { addType } from "pacc";
import { writeLines, sectionLines, asArray } from "../utils.mjs";
import { NetworkAddress, Host, cidrAddresses } from "pmcf";
import { ServiceOwner } from "../service-owner.mjs";

/**
 *
 */
export class SkeletonNetworkInterface extends ServiceOwner {
  
  static get typeName() {
    return "network_interface";
  }

  static {
    addType(this);
  }

  _network;

  get typeName() {
    return "network_interface";
  }

  get host() {
    if (this.owner instanceof Host) {
      return this.owner;
    }
  }

  get services() {
    return new AggregatedMap([super.services, this.owner.services]);
  }

  get hosts() {
    return asArray(this.host);
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
    return this.attribute("_network") ?? this.host?.network;
  }

  set network(network) {
    this._network = network;
  }

  get subnets() {
    return new Set(this.ipAddresses.values());
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
