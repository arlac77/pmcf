import { familyIP, formatCIDR } from "ip-utilties";
import { Subnet } from "./subnet.mjs";

/**
 * @property {NetworkInterface} networkInterface
 * @property {string|Uint8Array|Uint16Array} address
 * @property {string} family
 * @property {Subnet} subnet
 * @property {Set<string>} domainNames
 */
export class NetworkAddress {
  /** @type {Subnet} */ subnet;
  /** @type {NetworkInterface} */ networkInterface;
  /** @type {string|Uint8Array|Uint16Array} */ address;

  constructor(networkInterface, address, subnet) {
    this.networkInterface = networkInterface;
    this.address = address;
    this.subnet = subnet;
  }

  get domainNames() {
    return this.networkInterface.domainNames;
  }

  get family() {
    return familyIP(this.address);
  }

  get cidrAddress() {
    return formatCIDR(this.address, this.subnet.prefixLength);
  }
}
