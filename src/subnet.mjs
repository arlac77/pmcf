import {
  normalizeCIDR,
  isLinkLocal,
  isIPv4,
  isIPv6,
  rangeIP,
  decodeIP
} from "./ip.mjs";
import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

const SubnetTypeDefinition = {
  name: "subnet",
  owners: ["location", "owner", "network", "root"],
  priority: 0.6,
  constructWithIdentifierOnly: true,
  properties: {
    address: {
      type: "string",
      collection: false,
      writeable: false,
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
    owner.addObject(this);

    this.prefix = prefix;
    this.prefixLength = prefixLength;
    this.longPrefix = longPrefix;
  }

  get fullName() {
    return this.name;
  }

  matchesAddress(address) {
    return address.startsWith(this.prefix);
  }

  get isLinkLocal() {
    return isLinkLocal(this.address);
  }

  get isIPv4() {
    return isIPv4(this.address);
  }

  get isIPv6() {
    return isIPv6(this.address);
  }

  get addressRange() {
    return rangeIP(this.prefix, this.prefixLength, 0, 0).map(a => decodeIP(a));
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

export function subnets(sources) {
  const all = new Set();

  for (const owner of sources) {
    for (const subnet of owner.subnets()) {
      all.add(subnet);
    }
  }

  return all;
}
