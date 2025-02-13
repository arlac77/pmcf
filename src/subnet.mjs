import { normalizeCIDR, isLinkLocal } from "./utils.mjs";
import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

export class Subnet extends Base {
  networks = new Set();

  static {
    addType(this);
  }

  static get typeName() {
    return "subnet";
  }

  constructor(owner, data) {
    const { cidr } = normalizeCIDR(data.name);

    if (!cidr) {
      const error = Error(`Invalid address`);
      error.address = data.name;
      throw error;
    }

    data.name = cidr;

    super(owner, data);

    Object.assign(this, data);

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

  get propertyNames() {
    return [...super.propertyNames, "networks", "prefixLength"];
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
