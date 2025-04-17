import { join } from "node:path";
import { writeLines, sectionLines } from "../utils.mjs";
import { NetworkAddress, Host } from "pmcf";
import { ServiceOwner } from "../service-owner.mjs";
import { cidrAddresses } from "../network-support.mjs";

export class SkeletonNetworkInterface extends ServiceOwner {
  _extends = [];
  _network;

  static get typeName() {
    return "network_interface";
  }

  get typeName() {
    return "network_interface";
  }

  set extends(value) {
    this._extends.push(value);
  }

  get extends() {
    return this._extends;
  }

  get isTemplate() {
    return this.name.indexOf("*") >= 0;
  }

  get host() {
    if(this.owner instanceof Host) {
      return this.owner;
    }
  }

  *hosts() {
    yield* this.owner.hosts();
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
    return this.extendedProperty("_network") ?? this.host.network;
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
   * @param {object} filter
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

  async systemdDefinitions(packageData) {
    const networkDir = join(packageData.dir, "etc/systemd/network");

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
