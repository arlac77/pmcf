import {
  hasWellKnownSubnet,
  normalizeIP,
  familyIP,
  formatCIDR
} from "ip-utilties";
import { Base } from "./base.mjs";
import {
  Subnet,
  SUBNET_LOCALHOST_IPV4,
  SUBNET_LOCALHOST_IPV6
} from "./subnet.mjs";
import {
  networkProperties,
  networkAddressProperties
} from "./network-support.mjs";
import { asArray } from "./utils.mjs";
import { addType } from "./types.mjs";

/**
 * @property {NetworkInterface} networkInterface
 * @property {string|Uint8Array|Uint16Array} address
 * @property {string} family
 * @property {Subnet} subnet
 * @property {Set<string>} domainNames
 */
export class NetworkAddress {
  /** @type {Subnet} */ subnet;
  /** @type {NetworkInterface} */ networkInterface;
  /** @type {string|Uint8Array|Uint16Array} */ address;

  constructor(networkInterface, address, subnet) {
    this.networkInterface = networkInterface;
    this.address = address;
    this.subnet = subnet;
  }

  get domainNames() {
    return this.networkInterface.domainNames;
  }

  get family() {
    return familyIP(this.address);
  }

  get cidrAddress() {
    return formatCIDR(this.address, this.subnet.prefixLength);
  }
}

class SkeletonNetworkInterface extends Base {
  _extends = [];
  _network;

  set extends(value) {
    this._extends.push(value);
  }

  get extends() {
    return this._extends;
  }

  get isTemplate() {
    return this.name.indexOf("*") >= 0;
  }

  get host() {
    return this.owner;
  }

  get network_interface() {
    return this;
  }

  get domainNames() {
    return new Set();
  }

  matches(other) {
    if (this.isTemplate) {
      const name = this.name.replaceAll("*", "");
      return name.length === 0 || other.name.indexOf(name) >= 0;
    }

    return false;
  }

  get network() {
    return this.extendedProperty("_network") ?? this.host.network;
  }

  set network(network) {
    this._network = network;
  }

  get ipAddresses() {
    return new Map();
  }

  /**
   *
   * @param {object} filter
   * @return {Iterable<NetworkAddress>}
   */
  *networkAddresses(filter = n => true) {
    for (const [address, subnet] of this.ipAddresses) {
      const networkAddress = new NetworkAddress(this, address, subnet);

      if (filter(networkAddress)) {
        yield networkAddress;
      }
    }
  }

  networkAddress(filter) {
    for (const a of this.networkAddresses(filter)) {
      return a;
    }
  }

  get address() {
    return this.addresses[0];
  }

  get addresses() {
    return [...this.ipAddresses].map(([address]) => address);
  }
}

export const NetworkInterfaceTypeDefinition = {
  name: "network_interface",
  priority: 0.4,
  owners: ["host"],
  extends: Base.typeDefinition,
  specializations: {},
  factoryFor(value) {
    const kind = value.kind;
    const t = NetworkInterfaceTypeDefinition.specializations[kind];

    if (t) {
      delete value.type;
      return t.clazz;
    }

    return NetworkInterface;
  },
  properties: {
    ...networkProperties,
    ...networkAddressProperties,
    hostName: { type: "string", collection: false, writeable: true },
    ipAddresses: { type: "string", collection: true, writeable: true },

    hwaddr: { type: "string", collection: false, writeable: true },
    network: { type: "network", collection: false, writeable: true },
    destination: { type: "string", collection: false, writeable: true },
    arpbridge: { type: "network_interface", collection: true, writeable: true }
  }
};

export class NetworkInterface extends SkeletonNetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return NetworkInterfaceTypeDefinition;
  }

  _ipAddresses = new Map();
  _scope;
  _metric;
  _ssid;
  _psk;
  _kind;
  _hostName;
  _hwaddr;
  _class;
  arpbridge;

  constructor(owner, data) {
    super(owner, data);
    this.read(data, NetworkInterfaceTypeDefinition);
  }

  addSubnet(address) {
    if (!this.network) {
      if (!hasWellKnownSubnet(address)) {
        this.error("Missing network", address);
      }
    } else {
      return this.network.addSubnet(address);
    }
  }

  get ipAddresses() {
    return this._ipAddresses;
  }

  set ipAddresses(value) {
    for (const address of asArray(value)) {
      this._ipAddresses.set(normalizeIP(address), this.addSubnet(address));
    }
  }

  subnetForAddress(address) {
    return (
      this.network?.subnetForAddress(address) ||
      this.host.owner.subnetForAddress(address)
    );
  }

  get gateway() {
    return this.network?.gateway;
  }

  get gatewayAddress() {
    for (const a of this.gateway.networkAddresses()) {
      if (a.networkInterface.network === this.network) {
        return a.address;
      }
    }
  }

  get hostName() {
    return this.extendedProperty("_hostName") ?? this.host.hostName;
  }

  set hostName(value) {
    this._hostName = value;
  }

  get domainNames() {
    return this.hostName
      ? new Set([[this.hostName, this.host.domain].join(".")])
      : this.host.directDomainNames;
  }

  set scope(value) {
    this._scope = value;
  }

  get scope() {
    return (
      this.extendedProperty("_scope") ??
      this.network?.scope ??
      networkProperties.scope.default
    );
  }

  set hwaddr(value) {
    this._hwaddr = value;
  }

  get hwaddr() {
    return this.extendedProperty("_hwaddr");
  }

  set metric(value) {
    this._metric = value;
  }

  get metric() {
    return (
      this.extendedProperty("_metric") ??
      this.network?.metric ??
      networkProperties.metric.default
    );
  }

  set MTU(value) {
    this._MTU = value;
  }

  get MTU() {
    return this.extendedProperty("_MTU") ?? networkProperties.MTU.default;
  }

  set class(value) {
    this._class = value;
  }

  get class() {
    return this.extendedProperty("_class") ?? this.network?.class;
  }

  set ssid(value) {
    this._ssid = value;
  }

  get ssid() {
    return this.extendedProperty("_ssid") ?? this.network?.ssid;
  }

  set psk(value) {
    this._psk = value;
  }

  get psk() {
    return this.extendedProperty("_psk") ?? this.network?.psk;
  }

  set kind(value) {
    this._kind = value;
  }

  get kind() {
    return this.extendedProperty("_kind") ?? this.network?.kind;
  }
}

const LoopbackNetworkInterfaceTypeDefinition = {
  name: "loopback",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  extends: NetworkInterfaceTypeDefinition,
  priority: 0.1,
  properties: {}
};

const _localAddresses = new Map([
  ["127.0.0.1", SUBNET_LOCALHOST_IPV4],
  ["::1", SUBNET_LOCALHOST_IPV6]
]);

export class LoopbackNetworkInterface extends SkeletonNetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return LoopbackNetworkInterfaceTypeDefinition;
  }

  get kind() {
    return LoopbackNetworkInterfaceTypeDefinition.name;
  }

  get scope() {
    return "host";
  }

  get hostName() {
    return "localhost";
  }

  get ipAddresses() {
    return _localAddresses;
  }
}

const WireguardNetworkInterfaceTypeDefinition = {
  name: "wireguard",
  specializationOf: NetworkInterfaceTypeDefinition,
  owners: NetworkInterfaceTypeDefinition.owners,
  extends: NetworkInterfaceTypeDefinition,
  priority: 0.1,
  properties: {}
};

export class WireguardNetworkInterface extends SkeletonNetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return WireguardNetworkInterfaceTypeDefinition;
  }

  get kind() {
    return WireguardNetworkInterfaceTypeDefinition.name;
  }

  get ipAddresses() {
    return new Map();
  }
}
