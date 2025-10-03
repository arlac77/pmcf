import { join } from "node:path";
import { hasWellKnownSubnet, normalizeIP } from "ip-utilties";
import {
  default_attribute_writable,
  string_attribute_writable,
  hostname_attribute
} from "pacc";
import { Base, cidrAddresses } from "pmcf";
import {
  networkAttributes,
  networkAddressAttributes
} from "../network-support.mjs";
import { asArray, writeLines, sectionLines } from "../utils.mjs";
import { addType } from "../types.mjs";
import { SkeletonNetworkInterface } from "./skeleton.mjs";
import { Network } from "../network.mjs";

export const NetworkInterfaceTypeDefinition = {
  name: "network_interface",
  owners: ["host"],
  extends: Base.typeDefinition,
  specializations: {},
  factoryFor(owner, value) {
    let t = NetworkInterfaceTypeDefinition.specializations[value.kind];

    //console.log("factoryFor", owner, value);
    if (!t) {
      for (t of Object.values(NetworkInterfaceTypeDefinition.specializations)) {
        if (t.clazz.isCommonName && t.clazz.isCommonName(value.name)) {
          break;
        }
      }
    }

    if (t) {
      delete value.type;
      delete value.kind;
      return t.clazz;
    }

    return NetworkInterface;
  },
  key: "name",
  attributes: {
    ...networkAttributes,
    ...networkAddressAttributes,

    services: {
      ...default_attribute_writable,
      collection: true,
      type: "service"
    },
    hostName: { ...hostname_attribute, writable: true },
    ipAddresses: string_attribute_writable,
    hwaddr: string_attribute_writable,
    network: {
      ...default_attribute_writable,
      type: Network.typeDefinition
    },
    destination: string_attribute_writable
  }
};

export class NetworkInterface extends SkeletonNetworkInterface {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return NetworkInterfaceTypeDefinition;
  }

  static isCommonName(name) {
    false;
  }

  _ipAddresses = new Map();
  _scope;
  _metric;
  _kind;
  _hostName;
  _hwaddr;
  _class;

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
    const gateway = this.gateway;
    if (gateway) {
      for (const a of gateway.networkAddresses()) {
        if (a.networkInterface.network === this.network) {
          return a.address;
        }
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
      networkAttributes.scope.default
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
      networkAttributes.metric.default
    );
  }

  set mtu(value) {
    this._mtu = value;
  }

  get mtu() {
    return this.extendedProperty("_mtu"); // ?? networkAttributes.mtu.default;
  }

  set class(value) {
    this._class = value;
  }

  get class() {
    return this.extendedProperty("_class") ?? this.network?.class;
  }

  set kind(value) {
    this._kind = value;
  }

  get kind() {
    return this.extendedProperty("_kind") ?? this.network?.kind;
  }

  async systemdDefinitions(packageData) {
    await super.systemdDefinitions(packageData);

    const networkDir = join(packageData.dir, "etc/systemd/network");

    if (this.name !== "eth0" && this.hwaddr) {
      const disabled = {};
      if (this.disabled) {
        disabled.Unmanaged = "yes";
      }
      await writeLines(networkDir, `${this.name}.link`, [
        sectionLines("Match", { MACAddress: this.hwaddr }),
        "",
        sectionLines("Link", { Name: this.name, ...disabled })
      ]);
    }

    const networkSections = [sectionLines("Match", { Name: this.name })];

    for (const Address of cidrAddresses(this.networkAddresses())) {
      networkSections.push(
        "",
        sectionLines("Address", {
          Address
        })
      );
    }

    const routeSectionExtra = this.destination
      ? { Destination: this.destination }
      : this.gateway
      ? { Gateway: this.gatewayAddress }
      : {};

    const networkSectionExtra = this.arpbridge
      ? {
          IPForward: "yes",
          IPv4ProxyARP: "yes"
        }
      : {};

    networkSections.push(
      "",
      sectionLines("Network", {
        ...networkSectionExtra,
        DHCP: "no",
        DHCPServer: "no",
        MulticastDNS: this.network.multicastDNS ? "yes" : "no",
        LinkLocalAddressing: "ipv6",
        IPv6LinkLocalAddressGenerationMode: "stable-privacy"
      }),
      "",
      sectionLines("Route", {
        ...routeSectionExtra,
        Scope: this.scope,
        Metric: this.metric,
        InitialCongestionWindow: 20,
        InitialAdvertisedReceiveWindow: 20
      }),
      "",
      sectionLines("IPv6AcceptRA", {
        UseAutonomousPrefix: "true",
        UseOnLinkPrefix: "true",
        DHCPv6Client: "false",
        Token: "eui64"
      })
    );

    if (this.arpbridge) {
      networkSections.push("", sectionLines("Link", { Promiscuous: "yes" }));
    }

    await writeLines(
      networkDir,
      `${this.name}.network${this.disabled ? ".disabled" : ""}`,
      networkSections
    );
  }
}
