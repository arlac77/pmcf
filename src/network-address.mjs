import {
  default_attribute,
  string_attribute,
  type_attribute,
  getAttribute
} from "pacc";
import { familyIP, formatCIDR, decodeIP, addressType } from "ip-utilties";
import { Subnet } from "./subnet.mjs";
import { Owner, addType } from "pmcf";
import { NetworkInterface } from "./network-interfaces/network-interface.mjs";
import { family_attribute, subnet_attribute } from "./common-attributes.mjs";
import { asArray } from "./utils.mjs";
/**
 *
 */
export class NetworkAddress {
  static name = "network-address";
  static priority = 1;
  static key = "address";
  static attributes = {
    address: { ...string_attribute, name: "address" },
    type: type_attribute,
    cidrAddress: { ...string_attribute, name: "cidrAddress" },
    networkInterface: {
      ...default_attribute,
      name: "networkInterface",
      type: "network_interface"
    },
    family: family_attribute,
    subnet: subnet_attribute
  };

  static {
    addType(this);
  }

  /** @type {Subnet} */ subnet;
  /** @type {NetworkInterface} */ networkInterface;
  /** @type {string|Uint8Array|Uint16Array} */ address;

  /**
   *
   * @param {NetworkInterface} networkInterface
   * @param {string|Uint8Array|Uint16Array} address
   * @param {Subnet} subnet
   */
  constructor(networkInterface, address, subnet) {
    this.networkInterface = networkInterface;
    this.address = address;
    this.subnet = subnet;
  }

  get host() {
    return this.networkInterface.host;
  }

  get domainNames() {
    return this.networkInterface.domainNames;
  }

  get domains() {
    return this.networkInterface.domains;
  }

  get family() {
    return familyIP(this.address);
  }

  get cidrAddress() {
    return formatCIDR(this.address, this.subnet.prefixLength);
  }

  get type() {
    return addressType(this.address);
  }

  get fullName() {
    return `${this.networkInterface.fullName}/${decodeIP(this.address)}`;
  }

  toString() {
    return `${this.networkInterface.fullName} ${decodeIP(this.address)}`;
  }

  attribute(name) {
    return getAttribute(this, name);
  }

  value(name) {
    return this.attribute(name);
  }
}

/**
 *
 * @param {Iterable<Owner|string>} sources
 * @param {Object} options
 * @param {boolean} options.aggregate
 * @param {Object} options.filter
 * @returns {Iterable<string>} addresses
 */
export function addresses(sources, options) {
  return [
    ...new Set(
      asArray(sources)
        .map(s => {
          if (typeof s === "string") {
            return s;
          }
          if (options?.aggregate && s instanceof Owner && s.subnets.size > 0) {
            return [...s.subnets.keys()];
          }

          return s.networkAddresses
            ? [...s.networkAddresses(options?.filter)]
            : s;
        })
        .flat()
        .map(object =>
          typeof object === "string" ? object : decodeIP(object.address)
        )
    )
  ].filter(e => e !== "");
}

/**
 *
 * @param {Array<NetworkAddress>} networkAddresses
 * @returns {Array<string>}
 */
export function cidrAddresses(networkAddresses) {
  return [...networkAddresses].map(na => na.cidrAddress);
}

export function sortByFamilyAndAddress(a, b) {
  return a.family.localeCompare(b.family) ?? a.address.localeCompare(b.address);
}
