import {
  default_attribute,
  default_attribute_writable,
  default_collection_attribute_writable,
  string_collection_attribute_writable,
  string_attribute_writable,
  integer_attribute_writable,
  hostname_attribute as hostname_attribute_base,
  boolean_attribute_writable
} from "pacc";

export const networkAddressType = "network|host|network_interface";

export const owner_attribute = {
  ...default_attribute,
  name: "owner",
  type: "owner"
};

export const network_attribute = {
  ...default_attribute_writable,
  name: "network",
  type: "network"
};

export const networks_attribute = {
  ...default_collection_attribute_writable,
  name: "networks",
  type: "network",
  backpointer: owner_attribute
};

export const networkInterfaces_attribute = {
  ...default_collection_attribute_writable,
  name: "networkInterfaces",
  type: "network_interface",
  backpointer: owner_attribute
};

export const hosts_attribute = {
  ...default_collection_attribute_writable,
  name: "hosts",
  type: "host",
  backpointer: owner_attribute
};

export const owners_attribute = {
  ...default_collection_attribute_writable,
  name: "owners",
  type: "owner",
  backpointer: owner_attribute
};

export const cluster_attribute = {
  ...default_attribute_writable,
  name: "cluster",
  type: "cluster"
};

export const clusters_attribute = {
  ...default_collection_attribute_writable,
  name: "clusters",
  type: "cluster",
  backpointer: owner_attribute
};

export const subnets_attribute = {
  ...default_collection_attribute_writable,
  name: "subnets",
  type: "subnet",
  backpointer: networks_attribute
};

export const psk_attribute = { ...string_attribute_writable, name: "psk" };
export const ssid_attribute = { ...string_attribute_writable, name: "ssid" };
export const hostname_attribute = {
  ...hostname_attribute_base,
  name: "hostName",
  writable: true
};

export const networkAttributes = {
  scope: {
    ...string_attribute_writable,
    name: "scope",
    values: ["global", "site", "link", "host"]
    //  default: "global"
  },
  class: {
    ...string_attribute_writable,
    name: "class",
    values: ["10GBASE-T", "1000BASE-T", "100BASE-T", "10BASE-T"]
  },
  kind: {
    ...string_attribute_writable,
    name: "kind",
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: ssid_attribute,
  psk: psk_attribute,
  secretName: { ...string_attribute_writable, name: "secretName" },
  metric: { ...integer_attribute_writable, name: "metric" /*default: 1004*/ },
  mtu: { ...integer_attribute_writable, name: "mtu", default: 1500 },
  gateway: { ...default_attribute_writable, name: "gateway", type: "host" },
  multicastDNS: { ...boolean_attribute_writable, name: "multicastDNS" }
};

export const networkAddressAttributes = {
  hostName: hostname_attribute,
  cidrAddresses: {
    ...string_collection_attribute_writable,
    name: "cidrAddresses"
  },
  cidrAddress: { ...string_attribute_writable, name: "cidrAddress" },
  addresses: { ...string_collection_attribute_writable, name: "addresses" },
  address: { ...string_attribute_writable, name: "address" }
};
