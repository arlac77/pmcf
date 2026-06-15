import {
  normalizeCIDR,
  isLinkLocal,
  rangeIP,
  decodeIP,
  familyIP,
  matchPrefixIP,
  FAMILY_IPV6
} from "ip-utilties";
import { string_attribute, name_attribute, number_attribute } from "pacc";
import { networks_attribute } from "./network-support.mjs";
import { Base } from "./base.mjs";
import { addType } from "pmcf";

export class Subnet extends Base {
  static name = "subnet";
  static priority = 1;
  static owners = ["location", "owner", "network", "root"];
  static constructWithIdentifierOnly = true;
  static key = "address";
  static attributes = {
    address: name_attribute,
    networks: networks_attribute,
    prefixLength: number_attribute,
    family: string_attribute
  };

  static {
    addType(this);
  }

  networks = new Set();

  constructor(owner, address) {
    const { longPrefix, prefix, prefixLength, cidr } = normalizeCIDR(address);
    super(owner, cidr);

    this.prefix = prefix;
    this.prefixLength = prefixLength;
    this.longPrefix = longPrefix;
    this.family = familyIP(address);

    owner.addObject(this);
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

const _owner = { addObject() {} };
export const SUBNET_GLOBAL_IPV4 = new Subnet(_owner, "0.0.0.0/0");
export const SUBNET_GLOBAL_IPV6 = new Subnet(_owner, "::0/0");
export const SUBNET_LOCALHOST_IPV4 = new Subnet(_owner, "127.0.0.1/8");
export const SUBNET_LOCALHOST_IPV6 = new Subnet(_owner, "::1/128");
export const SUBNET_LINK_LOCAL_IPV6 = new Subnet(_owner, "fe80::/64");

export function subnets(sources) {
  let all = new Set();

  for (const source of sources) {
    all = all.union(source.subnets);
  }

  return all;
}
