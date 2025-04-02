export const networkProperties = {
  scope: {
    type: "string",
    collection: false,
    writeable: true,
    values: ["global", "site", "link", "host"]
  },
  kind: {
    type: "string",
    collection: false,
    writeable: true,
    values: ["loopback", "ethernet", "wlan", "wireguard", "fiber", "dsl"]
  },
  ssid: { type: "string", collection: false, writeable: true },
  psk: { type: "string", collection: false, writeable: true },
  metric: { type: "number", collection: false, writeable: true },
  MTU: { type: "number", collection: false, writeable: true },
  gateway: { type: "host", collection: false, writeable: true },
  multicastDNS: { type: "boolean", collection: false, writeable: true }
};

export const networkAddressProperties = {
  hostName: { type: "string", collection: false, writeable: true },
  cidrAddresses: { type: "string", collection: true, writeable: false },
  cidrAddress: { type: "string", collection: false, writeable: false },
  rawAddresses: { type: "string", collection: true, writeable: false },
  rawAddress: { type: "string", collection: false, writeable: false }
};
