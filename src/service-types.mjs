export const ServiceTypes = {
  "alpm-repo": {
    extends: ["https"]
  },
  syslog: {
    endpoints: [
      {
        protocol: "udp",
        family: "IPv4",
        port: 514,
        tls: false
      },
      {
        protocol: "udp",
        family: "IPv6",
        port: 514,
        tls: false
      },
      {
        protocol: "tcp",
        family: "IPv4",
        port: 514,
        tls: false
      },
      {
        protocol: "tcp",
        family: "IPv6",
        port: 514,
        tls: false
      }
    ]
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
  mdns: {
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 5353, tls: false },
      { family: "IPv6", protocol: "udp", port: 5353, tls: false }
    ]
  },
  llmnr: {
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 5355, tls: false },
      { family: "IPv4", protocol: "tcp", port: 5355, tls: false },
      { family: "IPv6", protocol: "udp", port: 5355, tls: false },
      { family: "IPv6", protocol: "tcp", port: 5355, tls: false }
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
  ldapi: {
    endpoints: [{ family: "unix", scheme: "ldapi", path: "/run/ldapi" }]
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
  submission: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 587, tls: false },
      { family: "IPv6", protocol: "tcp", port: 587, tls: false }
    ]
  },
  lmtp: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 24, tls: false },
      { family: "IPv6", protocol: "tcp", port: 24, tls: false }
    ]
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
  smb: {
    endpoints: [
      { family: "IPv4", protocol: "tcp", port: 445, tls: false },
      { family: "IPv6", protocol: "tcp", port: 445, tls: false }
    ]
  },
  timemachine: {
    extends: ["smb"],
    dnsRecord: {
      type: "TXT",
      parameters: {
        sys: "waMa=0",
        adVF: "0x100",
        dk0: "adVN=MF-TM-999"
        //  adVF: "0x82"
      }
    }
  },
  pcp: {
    // rfc6887
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 5351, tls: false },
      { family: "IPv6", protocol: "udp", port: 5351, tls: false }
    ]
  },
  "pcp-multicast": {
    // rfc6887
    endpoints: [
      { family: "IPv4", protocol: "udp", port: 5350, tls: false },
      { family: "IPv6", protocol: "udp", port: 5350, tls: false }
    ]
  }
};

Object.entries(ServiceTypes).forEach(([name, type]) =>
  addServiceType(type, name)
);

export function addServiceType(type, name) {
  if (type) {
    if (name) {
      type.name = name;
    }

    ServiceTypes[type.name] = type;
    if (type.endpoints) {
      type.endpoints.forEach(e => (e.type = type));
    } else {
      type.endpoints = [];
    }

    if (type.services) {
      Object.entries(type.services).forEach(([name, type]) =>
        addServiceType(type, name)
      );
    } else {
      type.services = {};
    }

    if (type.extends) {
      type.extends = type.extends.map(t =>
        typeof t === "string" ? ServiceTypes[t] : t
      );
    } else {
      type.extends = [];
    }
  }
  return type;
}

export function serviceTypes(type) {
  if (type) {
    let types = new Set([type.name]);

    for (const t of type.extends) {
      types = types.union(serviceTypes(t));
    }

    return types;
  }
  return new Set();
}

export function serviceTypeEndpoints(type) {
  if (type) {
    const all = type.services
      ? Object.values(type.services)
          .map(type => serviceTypeEndpoints(type))
          .flat()
      : [];

    if (type.extends) {
      all.push(type.extends.reduce((a, c) => [...a, ...c?.endpoints], []));
    }

    if (type.endpoints) {
      all.push(type.endpoints);
    }

    return all.flat();
  }

  return [];
}
