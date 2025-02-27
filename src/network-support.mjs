export const networkProperties = {
  scope: { type: "string", collection: false, writeable: true },
  kind: { type: "string", collection: false, writeable: true },
  ssid: { type: "string", collection: false, writeable: true },
  psk: { type: "string", collection: false, writeable: true },
  metric: { type: "number", collection: false, writeable: true },
  MTU: { type: "number", collection: false, writeable: true },
  gateway: { type: "host", collection: false, writeable: true }
};
