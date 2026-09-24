import  { duration_attribute_writable} from "pacc";
import { host } from "./host.mjs";

import { addType } from "./type.mjs";
import { networkInterfaces_attribute } from "./common-attributes.mjs";

export class cluster extends host {
  static priority = 1.5;
  static attributes = {
    members: {
      ...networkInterfaces_attribute,
      name: "members"
    },
        checkInterval: {
          ...duration_attribute_writable,
          name: "checkInterval",
          default: 60
        },
    
  };

  static {
    addType(this);
  }

  members = new Set();

  get isCluster() {
    return true;
  }

  isMember(host) {
    return super.isMember(host) || this.hosts.get(host.name) === host;
  }

  get hosts() {
    return new Map([...this.members].map(m => [m.host.name, m.host]));
  }

  get content() {
    return [...this.hosts.values()][0]?.content;
  }
}
