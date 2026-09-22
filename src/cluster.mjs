import { host } from "./host.mjs";
import { addType } from "./type.mjs";
import {
  networkInterfaces_attribute,
  cluster_attribute
} from "./common-attributes.mjs";

export class cluster extends host {
  static priority = 1.5;
  static attributes = {
    masters: {
      ...networkInterfaces_attribute,
      name: "masters",
      backpointer: cluster_attribute
    },
    backups: {
      ...networkInterfaces_attribute,
      name: "backups",
      backpointer: cluster_attribute
    },
    members: {
      ...networkInterfaces_attribute,
      name: "members"
    }
  };

  static {
    addType(this);
  }

  masters = [];
  backups = [];

  get members() {
    return new Set(this.masters).union(new Set(this.backups));
  }

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
