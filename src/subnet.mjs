import {
  normalizeCIDR,
  isLinkLocal,
  isIPv4Address,
  isIPv6Address
} from "./utils.mjs";
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
    const { cidr } = normalizeCIDR(address);
    super(owner, cidr);
    owner.addObject(this);
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
    return isIPv4Address(this.address);
  }

  get isIPv6() {
    return isIPv6Address(this.address);
  }

  get addressRange() {
    const l = this.prefixLength;
    return l === 24
      ? [this.prefix + ".0", this.prefix + ".255"]
      : [this.prefix + ".0.0", this.prefix + ".255.255"];
  }

  get longPrefix() {
    const prefix = this.prefix;

    switch (this.prefixLength) {
      case 24:
        return prefix + ".0";
      case 16:
        return prefix + ".0.0";
    }

    return prefix;
  }

  get prefix() {
    const [prefix] = this.name.split("/");
    return prefix;
  }

  get prefixLength() {
    const m = this.name.match(/\/(\d+)$/);
    if (m) {
      return parseInt(m[1]);
    }
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
