import {
  Owner,
  Location,
  Network,
  Subnet,
  Host,
  Cluster,
  Root,
  MosquittoService
} from "pmcf";

/**
 *
 * @param {Root} root
 * @param {string|string[]} filter
 * @returns {Object}
 */
export function root1(root, filter) {
  const mosquitto = {
    name: "mosquitto",
    fullName: "services/mosquitto/mosquitto",
    instanceof: MosquittoService,
    isTemplate: true
  };

  const L1 = {
    instanceof: Location,
    owner: root,
    description: "somewhere",
    domain: "mydomain.com",
    country: "DE",
    locales: ["C.UTF-8", "de_DE.UTF-8", "en_US.UTF-8"],
    timezone: "Europe/Berlin",
    administratorEmail: "admin@mydomain.com"
  };
  const L2 = {
    instanceof: Location,
    owner: root,
    description: "somewhere else"
  };

  const s1 = { instanceof: Subnet, name: "192.168.1/24", networks: [] };

  const L1n1 = {
    instanceof: Network,
    owner: L1,
    scope: "global",
    kind: "wlan",
    metric: 1010,
    ssid: "ID2",
    description: "home wifi",
    subnets: [s1]
  };
  const L1n2 = {
    instanceof: Network,
    owner: L1,
    scope: "site",
    kind: "ethernet",
    metric: 1010,
    subnets: [s1]
  };

  L1.networks = [L1n1, L1n2];
  s1.networks.push(L1n1);
  s1.networks.push(L1n2);

  const host1 = {
    name: "host1",
    instanceof: Host,
    owner: L1,
    location: L1,
    os: "linux",
    depends: ["d1", "d2-linux", "d3"],
    replaces: ["r1", "r2-linux", "r3"],
    provides: ["p1", "p2-linux", "p3-host1", "p4"],
    networkInterfaces: {
      eth0: {
        network: L1n1,
        metric: 1010,
        addresses: ["192.168.1.1"]
      }
    },
    services: {
      dns: { type: "dns", alias: "dns" },
      smb: { type: "smb" },
      timemachine: {
        extends: ["/services/timemachine/timemachine"],
        type: "timemachine"
      },
      mdns: {
        extends: ["/services/timemachine/mdns"]
      },
      mosquitto: {
        extends: ["/services/mosquitto/mosquitto"],
        type: "mosquitto",
        alias: "mqtt",
        port: 1883,
        persistence_location: "/var/lib/mosquitto",
        password_file: "/etc/mosquitto/passwd",
        acl_file: "/etc/mosquitto/acl"
      },
      openldap: {
        extends: [],
        type: "openldap",
        alias: "ldap",
        uri: "ldap://"
      },
      chrony: { extends: [], type: "chrony", alias: "ntp", port: 323 }
    }
  };

  const host2 = {
    name: "host2",
    domain: "mydomain.com",
    instanceof: Host,
    owner: L1n1,
    location: L1,
    os: "linux",
    packaging: new Set(["arch"]),
    networkInterfaces: {
      wlan0: {
        network: L1n1,
        metric: 1010,
        ssid: "ID2",
        addresses: ["192.168.1.2"],
        kind: "wlan"
      }
    },
    services: {
      dns: { type: "dns", alias: "dns", priority: 7 },
      smb: { type: "smb" }
    }
  };

  const L1C1 = {
    name: "C1",
    instanceof: Cluster,
    routerId: 77,
    masters: [host1.networkInterfaces.eth0],
    backups: [host2.networkInterfaces.wlan0]
  };

  const model = {
    name: "model",
    instanceof: Owner,
    isTemplate: true
  };

  const services = {
    name: "services",
    instanceof: Owner,
    isTemplate: true
  };

  const all = {
    "/L1": L1,
    "/L1/C1": L1C1,
    "/L1/n1": L1n1,
    "/L1/n2": L1n2,
    "/L1/n1/host2": host2,
    "/L1/host1": host1,
    "/L2": L2,
    "/services": services,
    "/services/mosquitto/mosquitto": mosquitto,
    "/model": model,
    "/model/m1": {
      name: "m1",
      instanceof: Host,
      owner: model,
      isModel: true,
      isTemplate: true,
      packaging: new Set(["arch"]),
      chassis: "server",
      services: {
        smb: { type: "smb" }
      }
    }
  };

  for (const [k, v] of Object.entries(all)) {
    if (!v.name) {
      const path = k.split("/");
      v.name = path.pop();
    }
  }

  if (typeof filter === "string") {
    return all[filter];
  }

  const filtered = {};
  for (const [k, v] of Object.entries(all)) {
    if (filter && filter.indexOf(k) < 0) {
    } else {
      filtered[k] = v;
    }
  }

  return filtered;
}
