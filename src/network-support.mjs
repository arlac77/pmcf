export const networkProperties = {
  scope: {
    type: "string",
    collection: false,
    writeable: true,
    values: ["global", "site", "link", "host"],
    default: "global"
  },
  class: {
    type: "string",
    collection: false,
    writeable: true,
    values: ["10GBASE-T", "1000BASE-T", "100BASE-T", "10BASE-T"]
  },
  kind: {
    type: "string",
    collection: false,
    writeable: true,
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: { type: "string", collection: false, writeable: true },
  psk: { type: "string", collection: false, writeable: true },
  metric: { type: "number", collection: false, writeable: true, default: 1004 },
  MTU: { type: "number", collection: false, writeable: true, default: 1500 },
  gateway: { type: "host", collection: false, writeable: true },
  multicastDNS: {
    type: "boolean",
    collection: false,
    writeable: true,
    default: false
  }
};

export const networkAddressProperties = {
  hostName: { type: "string", collection: false, writeable: true },
  cidrAddresses: { type: "string", collection: true, writeable: false },
  cidrAddress: { type: "string", collection: false, writeable: false },
  addresses: { type: "string", collection: true, writeable: false },
  address: { type: "string", collection: false, writeable: false }
};
