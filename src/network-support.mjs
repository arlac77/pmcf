import { default_attribute, hostname_attribute, boolean_attribute } from "pacc";

export const networkProperties = {
  scope: {
    ...default_attribute,
    writeable: true,
    values: ["global", "site", "link", "host"],
    default: "global"
  },
  class: {
    ...default_attribute,
    writeable: true,
    values: ["10GBASE-T", "1000BASE-T", "100BASE-T", "10BASE-T"]
  },
  kind: {
    ...default_attribute,
    writeable: true,
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: { ...default_attribute, writeable: true },
  psk: { ...default_attribute, writeable: true },
  metric: { type: "number", collection: false, writeable: true, default: 1004 },
  mtu: { type: "number", collection: false, writeable: true, default: 1500 },
  gateway: { type: "host", collection: false, writeable: true },
  multicastDNS: {
    ...boolean_attribute,
    writeable: true
  }
};

export const networkAddressProperties = {
  hostName: { ...hostname_attribute, writeable: true },
  cidrAddresses: { ...default_attribute, collection: true, writeable: false },
  cidrAddress: { ...default_attribute, writeable: false },
  addresses: { ...default_attribute, collection: true, writeable: false },
  address: { ...default_attribute, writeable: false }
};
