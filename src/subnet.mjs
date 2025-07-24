import {
  normalizeCIDR,
  isLinkLocal,
  rangeIP,
  decodeIP,
  familyIP,
  matchPrefixIP
} from "ip-utilties";
import { default_attribute } from "pacc";
import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

const SubnetTypeDefinition = {
  name: "subnet",
  owners: ["location", "owner", "network", "root"],
  priority: 0.6,
  constructWithIdentifierOnly: true,
  properties: {
    address: {
      ...default_attribute,
      identifier: true
    },
    networks: { type: "network", collection: true, writeable: true },
    prefixLength: { type: "number", collection: false, writeable: false }
  }
};

export class Subnet extends Base {
  networks = new Set();

  static {
    addType(this);
  }

  static get typeDefinition() {
    return SubnetTypeDefinition;
  }

  constructor(owner, address) {
    const { longPrefix, prefix, prefixLength, cidr } = normalizeCIDR(address);
    super(owner, cidr);

    this.prefix = prefix;
    this.prefixLength = prefixLength;
    this.longPrefix = longPrefix;
    this.family = familyIP(address);

    owner.addObject(this);
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
      rangeIP(this.prefix, this.prefixLength, 51, 6).map(a => decodeIP(a))
    ];
  }

  get address() {
    return this.name;
  }

  get longAddress() {
    return `${this.longPrefix}/${this.prefixLength}`;
  }

  _traverse(...args) {
    if (super._traverse(...args)) {
      for (const network of this.networks) {
        network._traverse(...args);
      }
      return true;
    }

    return false;
  }
}

const _owner = { addObject() {} };
export const SUBNET_GLOBAL_IPV4 = new Subnet(_owner, "0.0.0.0/0");
export const SUBNET_GLOBAL_IPV6 = new Subnet(_owner, "::0/0");
export const SUBNET_LOCALHOST_IPV4 = new Subnet(_owner, "127.0.0.1/8");
export const SUBNET_LOCALHOST_IPV6 = new Subnet(_owner, "::1/128");
export const SUBNET_LINK_LOCAL_IPV6 = new Subnet(_owner, "fe80::/64");

export function subnets(sources) {
  const all = new Set();

  for (const source of sources) {
    for (const subnet of source.subnets()) {
      all.add(subnet);
    }
  }

  return all;
}
