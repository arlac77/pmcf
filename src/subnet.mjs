import {
  normalizeCIDR,
  isLinkLocal,
  rangeIP,
  decodeIP,
  familyIP,
  matchPrefixIP,
  FAMILY_IPV6
} from "ip-utilties";
import { string_attribute, name_attribute, integer_attribute } from "pacc";
import { networks_attribute } from "./common-attributes.mjs";
import { Base } from "./base.mjs";
import { addType } from "pmcf";

export class Subnet extends Base {
  static name = "subnet";
  static priority = 1;
  static owners = ["owner", "network", "root"];
  static constructWithIdentifierOnly = true;
  static key = "address";
  static attributes = {
    address: { ...name_attribute, name: "address", private: true },
    networks: networks_attribute,
    prefixLength: { ...integer_attribute, name: "prefixLength" },
    family: { ...string_attribute, name: "family" }
  };

  static {
    addType(this);
  }

  networks = new Set();

  constructor(address) {
    super();

    const { longPrefix, prefix, prefixLength, cidr } = normalizeCIDR(address);

    this.name = cidr;
    this.prefix = prefix;
    this.prefixLength = prefixLength;
    this.longPrefix = longPrefix;
    this.family = familyIP(address);
  }

  get cidr() {
    return this.name;
  }

  get fullName() {
    return this.name;
  }

  matchesAddress(address) {
    return matchPrefixIP(this.address, this.prefixLength, address);
  }

  get isLinkLocal() {
    return isLinkLocal(this.address);
  }

  get addressRange() {
    return rangeIP(this.prefix, this.prefixLength, 1, 1).map(a => decodeIP(a));
  }

  get dhcpPools() {
    /* TODO where to take values from ? */

    return [
      this.family === FAMILY_IPV6
        ? this.cidr
        : rangeIP(this.prefix, this.prefixLength, 51, 6).map(a => decodeIP(a))
    ];
  }

  get address() {
    return this.name;
  }

  get longAddress() {
    return `${this.longPrefix}/${this.prefixLength}`;
  }
}

export const SUBNET_GLOBAL_IPV4 = new Subnet("0.0.0.0/0");
export const SUBNET_GLOBAL_IPV6 = new Subnet("::0/0");
export const SUBNET_LOCALHOST_IPV4 = new Subnet("127.0.0.1/8");
export const SUBNET_LOCALHOST_IPV6 = new Subnet("::1/128");
export const SUBNET_LINK_LOCAL_IPV6 = new Subnet("fe80::/64");

/**
 *
 * @param {*} sources
 * @returns {Set<string>}
 */
export function subnets(sources) {
  let all = new Set();

  for (const source of sources) {
    all = all.union(source.subnets.values());
  }

  return all;
}
