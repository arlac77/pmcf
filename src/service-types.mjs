export const ServiceTypes = {
  "pacman-repo": {
    extends: ["https"]
  },
  mqtt: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 1883, tls: false },
      { family: "IPv6", protocol: "tcp", port: 1883, tls: false }
    ]
  },
  "secure-mqtt": {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 8883, tls: true },
      { family: "IPv6", protocol: "tcp", port: 8883, tls: true }
    ]
  },
  ntp: {
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 123, tls: false },
      { family: "IPv6", protocol: "udp", port: 123, tls: false }
    ]
  },
  dns: {
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 53, tls: false },
      { family: "IPv6", protocol: "udp", port: 53, tls: false }
    ]
  },
  ldap: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 389, tls: false },
      { family: "IPv6", protocol: "tcp", port: 389, tls: false }
    ]
  },
  ldaps: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 636, tls: true },
      { family: "IPv6", protocol: "tcp", port: 636, tls: true }
    ]
  },
  http: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 80, tls: false },
      { family: "IPv6", protocol: "tcp", port: 80, tls: false }
    ]
  },
  https: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 443, tls: true },
      { family: "IPv6", protocol: "tcp", port: 443, tls: true }
    ],
    dnsRecord: { type: "HTTPS", parameters: { alpn: "h2" } }
  },
  http3: {
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 443, tls: true },
      { family: "IPv6", protocol: "udp", port: 443, tls: true }
    ],
    dnsRecord: {
      type: "HTTPS",
      parameters: { "no-default-alpn": undefined, alpn: "h3" }
    }
  },
  rtsp: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 554, tls: false },
      { family: "IPv6", protocol: "tcp", port: 554, tls: false }
    ]
  },
  smtp: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 25, tls: false },
      { family: "IPv6", protocol: "tcp", port: 25, tls: false }
    ],
    dnsRecord: { type: "MX" }
  },
  ssh: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 22, tls: false },
      { family: "IPv6", protocol: "tcp", port: 22, tls: false }
    ]
  },
  imap: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 143, tls: false },
      { family: "IPv6", protocol: "tcp", port: 143, tls: false }
    ]
  },
  imaps: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 993, tls: true },
      { family: "IPv6", protocol: "tcp", port: 993, tls: true }
    ]
  },
  dhcp: {
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 547, tls: false },
      { family: "IPv6", protocol: "udp", port: 547, tls: false }
    ]
  },
  "dhcpv6-client": {
    endpoints: [
      { family: "IPv6", protocol: "tcp", port: 546, tls: false },
      { family: "IPv6", protocol: "udp", port: 546, tls: false }
    ]
  },
  "dhcpv6-server": { endpoints: [{ family: "IPv6", port: 547, tls: false }] },
  smb: { endpoints: [{ protocol: "tcp", port: 445, tls: false }] },
  timemachine: {
    extends: ["smb"],
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 445, tls: false },
      { family: "IPv6", protocol: "tcp", port: 445, tls: false }
    ],
    dnsRecord: {
      type: "TXT",
      parameters: {
        sys: "waMa=0",
        adVF: "0x100",
        dk0: "adVN=MF-TM-999"
        //  adVF: "0x82"
      }
    }
  }
};

function prepareEndPoints(type, td) {
  if (td.endpoints) {
    td.endpoints.forEach(e => (e.type = type));
  }
}

Object.entries(ServiceTypes).forEach(([type, td]) =>
  prepareEndPoints(type, td)
);

export function addServiceTypes(st) {
  for (const [type, td] of Object.entries(st)) {
    ServiceTypes[type] = td;
    prepareEndPoints(type, td);

    if (td.services) {
      addServiceTypes(td.services);
    }
  }
}

export function serviceTypeEndpoints(type) {
  let td = ServiceTypes[type];
  if (td) {
    const all = td.services
      ? Object.keys(td.services)
          .map(type => serviceTypeEndpoints(type))
          .flat()
      : [];

    if (td.extends) {
      all.push(
        td.extends.reduce(
          (a, c) => [...a, ...(ServiceTypes[c]?.endpoints || [])],
          []
        )
      );
    }

    if (td.endpoints) {
      all.push(td.endpoints);
    }

    return all.flat();
  }

  return [];
}
