import { familyIP, formatCIDR,decodeIP } from "ip-utilties";
import { Subnet } from "./subnet.mjs";

/**
 * 
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


  toString()
  {
    return `${this.networkInterface.fullName} ${decodeIP(this.address)}`;
  }
}
