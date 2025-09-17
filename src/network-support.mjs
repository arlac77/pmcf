import {
  string_collection_attribute_writable,
  string_attribute_writable,
  number_attribute_writable,
  hostname_attribute,
  boolean_attribute_writable
} from "pacc";

export const networkAddressType = ["network", "host", "network_interface"];

export const networkAttributes = {
  scope: {
    ...string_attribute_writable,
    values: ["global", "site", "link", "host"]
    //  default: "global"
  },
  class: {
    ...string_attribute_writable,
    values: ["10GBASE-T", "1000BASE-T", "100BASE-T", "10BASE-T"]
  },
  kind: {
    ...string_attribute_writable,
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: string_attribute_writable,
  psk: string_attribute_writable,
  secretName: string_attribute_writable,
  metric: { ...number_attribute_writable /*default: 1004*/ },
  mtu: { ...number_attribute_writable, default: 1500 },
  gateway: { type: "host", collection: false, writable: true },
  multicastDNS: boolean_attribute_writable
};

export const networkAddressAttributes = {
  hostName: { ...hostname_attribute, writable: true },
  cidrAddresses: string_collection_attribute_writable ,
  cidrAddress: string_attribute_writable,
  addresses: string_collection_attribute_writable,
  address: string_attribute_writable
};
