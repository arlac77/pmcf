export const ServiceTypes = {
  "pacman-repo": {
    extends: ["https"]
  },
  mqtt: { endpoints: [{ protocol: "tcp", port: 1883, tls: false }] },
  "secure-mqtt": { endpoints: [{ protocol: "tcp", port: 8883, tls: true }] },
  ntp: { endpoints: [{ protocol: "udp", port: 123, tls: false }] },
  dns: { endpoints: [{ protocol: "udp", port: 53, tls: false }] },
  ldap: { endpoints: [{ protocol: "tcp", port: 389, tls: false }] },
  ldaps: { endpoints: [{ protocol: "tcp", port: 636, tls: true }] },
  http: { endpoints: [{ protocol: "tcp", port: 80, tls: false }] },
  https: {
    endpoints: [{ protocol: "tcp", port: 443, tls: true }],
    dnsRecord: { type: "HTTPS", parameters: { alpn: "h2" } }
  },
  http3: {
    extends: ["https"],
    dnsRecord: {
      type: "HTTPS",
      parameters: { "no-default-alpn": undefined, alpn: "h3" }
    }
  },
  rtsp: { endpoints: [{ protocol: "tcp", port: 554, tls: false }] },
  smtp: {
    endpoints: [{ protocol: "tcp", port: 25, tls: false }],
    dnsRecord: { type: "MX" }
  },
  ssh: { endpoints: [{ protocol: "tcp", port: 22, tls: false }] },
  imap: { endpoints: [{ protocol: "tcp", port: 143, tls: false }] },
  imaps: { endpoints: [{ protocol: "tcp", port: 993, tls: true }] },
  dhcp: { endpoints: [{ protocol: "udp", port: 547, tls: false }] },
  "dhcpv6-client": {
    endpoints: [
      { protocol: "tcp", port: 546, tls: false },
      { protocol: "udp", port: 546, tls: false }
    ]
  },
  "dhcpv6-server": { endpoints: [{ port: 547, tls: false }] },
  smb: { endpoints: [{ protocol: "tcp", port: 445, tls: false }] },
  timemachine: {
    extends: ["smb"],
    endpoints: [{ protocol: "tcp", port: 445, tls: false }],
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

export function addServiceTypes(st) {
  Object.assign(ServiceTypes, st);
}

export function serviceTypeEndpoints(type) {
  let st = ServiceTypes[type];
  if (st) {
    if (st.extends) {
      return st.extends.reduce(
        (a, c) => [...a, ...(ServiceTypes[c]?.endpoints || [])],
        st.endpoints || []
      );
    }

    return st.endpoints;
  }

  return [
    {
      tls: false
    }
  ];
}
