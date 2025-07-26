import { default_attribute, hostname_attribute, boolean_attribute } from "pacc";

export const networkProperties = {
  scope: {
    ...default_attribute,
    writable: true,
    values: ["global", "site", "link", "host"],
    default: "global"
  },
  class: {
    ...default_attribute,
    writable: true,
    values: ["10GBASE-T", "1000BASE-T", "100BASE-T", "10BASE-T"]
  },
  kind: {
    ...default_attribute,
    writable: true,
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: { ...default_attribute, writable: true },
  psk: { ...default_attribute, writable: true },
  metric: { type: "number", collection: false, writable: true, default: 1004 },
  mtu: { type: "number", collection: false, writable: true, default: 1500 },
  gateway: { type: "host", collection: false, writable: true },
  multicastDNS: {
    ...boolean_attribute,
    writable: true
  }
};

export const networkAddressProperties = {
  hostName: { ...hostname_attribute, writable: true },
  cidrAddresses: { ...default_attribute, collection: true, writable: false },
  cidrAddress: { ...default_attribute, writable: false },
  addresses: { ...default_attribute, collection: true, writable: false },
  address: { ...default_attribute, writable: false }
};
