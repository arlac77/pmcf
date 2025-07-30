import {
  string_collection_attribute,
  string_attribute,
  number_attribute_writable,
  hostname_attribute,
  boolean_attribute_writable
} from "pacc";

export const networkProperties = {
  scope: {
    ...string_attribute,
    writable: true,
    values: ["global", "site", "link", "host"],
  //  default: "global"
  },
  class: {
    ...string_attribute,
    writable: true,
    values: ["10GBASE-T", "1000BASE-T", "100BASE-T", "10BASE-T"]
  },
  kind: {
    ...string_attribute,
    writable: true,
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: { ...string_attribute, writable: true },
  psk: { ...string_attribute, writable: true },
  metric: { ...number_attribute_writable, /*default: 1004*/ },
  mtu: { ...number_attribute_writable, default: 1500 },
  gateway: { type: "host", collection: false, writable: true },
  multicastDNS: boolean_attribute_writable,
};

export const networkAddressProperties = {
  hostName: { ...hostname_attribute, writable: true },
  cidrAddresses: { ...string_collection_attribute, writable: false },
  cidrAddress: { ...string_attribute, writable: false },
  addresses: { ...string_collection_attribute, writable: false },
  address: { ...string_attribute, writable: false }
};
