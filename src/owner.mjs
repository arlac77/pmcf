import { normalizeCIDR, familyIP, FAMILY_IPV4 } from "ip-utilties";
import { FileContentProvider } from "npm-pkgbuild";
import { AggregatedMap } from "aggregated-map";

import {
  string_set_attribute_writable,
  string_attribute_writable,
  email_attribute
} from "pacc";
import { asArray, union } from "./utils.mjs";
import { Base } from "./base.mjs";
import { Subnet, SUBNET_GLOBAL_IPV4, SUBNET_GLOBAL_IPV6 } from "./subnet.mjs";
import {
  networks_attribute,
  owners_attribute,
  hosts_attribute,
  clusters_attribute,
  subnets_attribute,
  networkInterfaces_attribute
} from "./common-attributes.mjs";
import { addType, assign } from "pmcf";
import { loadHooks } from "./hooks.mjs";

export class Owner extends Base {
  static name = "owner";
  static priority = 2;
  static owners = [Owner, "root"];
  static attributes = {
    networks: networks_attribute,
    hosts: hosts_attribute,
    clusters: clusters_attribute,
    owners: owners_attribute,
    subnets: subnets_attribute,
    networkInterfaces: networkInterfaces_attribute,
    country: { ...string_attribute_writable, name: "country" },
    domain: { ...string_attribute_writable, name: "domain" },
    domains: { ...string_set_attribute_writable, name: "domains" },
    timezone: { ...string_attribute_writable, name: "timezone" },
    architectures: {
      ...string_set_attribute_writable,
      name: "architectures",
      description: "all supported architectures"
    },
    locales: {
      ...string_set_attribute_writable,
      name: "locales",
      description: "unix locale"
    },
    administratorEmail: {
      ...email_attribute,
      name: "administratorEmail",
      writable: true
    }
  };

  static {
    addType(this);
  }

  owners = new Map();
  networkInterfaces = new Map();
  _networks = new Map();
  _clusters = new Map();
  _hosts = new Map();
  _subnets = new Map();

  get hosts() {
    return new AggregatedMap(
      [this, ...this.networks.values(), ...this.owners.values()]
        .map(node => [node._hosts, node._clusters])
        .flat()
    );
  }

  set hosts(value) {
    this._hosts = value;
  }

  get clusters() {
    return new AggregatedMap(
      [this, ...this.networks.values(), ...this.owners.values()].map(
        node => node._clusters
      )
    );
  }

  set clusters(value) {
    this._clusters = value;
  }

  get networks() {
    return new AggregatedMap(
      [this, ...this.owners.values()].map(node => node._networks)
    );
  }

  set networks(value) {
    this._networks = value;
  }

  get services() {
    return new AggregatedMap(
      [...this.hosts.values()].map(host => host.services)
    );
  }

  get network() {
    return [...this.networks.values()][0] || super.network;
  }

  get subnets() {
    return this._subnets;
  }

  set subnets(value) {
    this.addSubnet(value);
  }

  addSubnet(address) {
    if (address instanceof Subnet) {
      this._subnets.set(address.name, address);
      return address;
    }

    const { cidr, prefixLength } = normalizeCIDR(address);

    if (cidr && prefixLength !== 0) {
      const subnet = this._subnets.get(cidr);
      if (subnet) {
        return subnet;
      }
      return assign(subnets_attribute, this, new Subnet(cidr));
    }

    let subnet = this.subnetForAddress(address);

    if (!subnet) {
      subnet =
        familyIP(address) === FAMILY_IPV4
          ? SUBNET_GLOBAL_IPV4
          : SUBNET_GLOBAL_IPV6;

      this.error(
        `Address without subnet ${address} available (${[...this.subnets.keys()]})`
      );
    }

    this._subnets.set(subnet.name, subnet);
    return subnet;
  }

  /**
   *
   * @param {string} address
   * @returns {Subnet?}
   */
  subnetForAddress(address) {
    return this.subnets.values().find(subnet => subnet.matchesAddress(address));
  }

  get derivedPackaging() {
    let all = new Set();
    for (const host of this.hosts.values()) {
      all = all.union(host.packaging);
    }

    return all;
  }

  *networkAddresses(filter) {
    for (const host of this.hosts.hosts()) {
      yield* host.networkAddresses(filter);
    }
  }

  _country;

  set country(value) {
    this._country = value;
  }

  get country() {
    return this._country ?? this.owner?.country;
  }

  _locales = new Set();

  set locales(value) {
    this._locales = union(value, this._locales);
  }

  get locales() {
    return this.unionFromDirections(["this", "owner"], "_locales");
  }

  _timezone;

  set timezone(value) {
    this._timezone = value;
  }

  get timezone() {
    return this._timezone ?? this.owner?.timezone;
  }

  _administratorEmail;

  set administratorEmail(value) {
    this._administratorEmail = value;
  }

  get administratorEmail() {
    if (this._administratorEmail) {
      return this._administratorEmail;
    }

    if (this.owner && !this._domain) {
      return this.owner.administratorEmail;
    }

    return "admin@" + this.domain;
  }

  _domain;

  set domain(value) {
    this._domain = value;
  }

  get domain() {
    return this._domain ?? this.owner?.domain;
  }

  get domains() {
    let domains = new Set();

    for (const object of this.hosts.values()) {
      domains = domains.union(object.domains);
    }

    return domains;
  }

  get localDomains() {
    return new Set(asArray(this.domain));
  }

  get domainNames() {
    let names = new Set();

    for (const host of this.hosts.values()) {
      names = names.union(new Set(host.domainNames));
    }

    return names;
  }

  _architectures;

  set architectures(value) {
    this._architectures = union(value, this._architectures);
  }

  get architectures() {
    if (this._architectures) {
      return this._architectures;
    }

    const architectures = new Set();

    for (const host of this.hosts.values()) {
      architectures.add(host.architecture);
    }

    return architectures;
  }

  async *preparePackages(dir) {
    const packageData = {
      sources: [
        new FileContentProvider(dir + "/"),
        new FileContentProvider(
          { dir: this.directory, pattern: "location.json" },
          { destination: "/etc/location/location.json" }
        )
      ],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.name}`,
        description: `${this.typeName} definitions for ${this.fullName}`,
        access: "private",
        dependencies: { jq: ">=1.6" },
        provides: ["location"]
      }
    };

    await loadHooks(
      packageData,
      new URL("location.install", import.meta.url).pathname
    );

    yield packageData;
  }
}
