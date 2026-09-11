import { AggregatedMap } from "aggregated-map";
import { asArray } from "pacc";
import { host } from "../host.mjs";
import { addType } from "../type.mjs";
import { ServiceOwner } from "../service-owner.mjs";

/**
 *
 */
export class Interface extends ServiceOwner {
  static get typeName() {
    return "interface";
  }

  static commonNamePattern = new RegExp(`^${this.name}\d+$`);

  static isCommonName(name) {
    return this.commonNamePattern.test(name);
  }

  static {
    addType(this);
  }

  get typeName() {
    const type = this.constructor;
    return type.specializationOf?.name || type.name;
  }

  get kind() {
    return this.constructor.name;
  }

  get host() {
    if (this.owner instanceof host) {
      return this.owner;
    }
  }

  get hosts() {
    return asArray(this.host);
  }

  get domainName() {
    return this.host?.domainName;
  }

  get domainNames() {
    return new Set();
  }

  get services() {
    return this.owner
      ? new AggregatedMap([super.services, this.owner._services])
      : super.services;
  }

  matches(other) {
    if (this.isTemplate) {
      const name = this.name.replaceAll("*", "");
      return name.length === 0 || other.name.indexOf(name) >= 0;
    }

    return false;
  }
}
