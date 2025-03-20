import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

const AddressTypeDefinition = {
  name: "address",
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
  }
};


export class Address extends Base {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return AddressTypeDefinition;
  }

  constructor(owner, address) {
    super(owner, address);
  }
}