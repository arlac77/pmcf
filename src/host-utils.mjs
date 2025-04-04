import {
  writeFile,
  mkdir,
  copyFile,
  glob,
  chmod,
  stat
} from "node:fs/promises";
import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { writeLines, sectionLines } from "../src/utils.mjs";
import { addHook } from "./hooks.mjs";

export async function generateMachineInfo(host, packageData) {
  const etcDir = join(packageData.dir, "etc");
  await writeLines(
    etcDir,
    "machine-info",
    Object.entries({
      CHASSIS: host.chassis,
      DEPLOYMENT: host.deployment,
      LOCATION: host.location.name,
      HARDWARE_VENDOR: host.vendor,
      HARDWARE_MODEL: host.modelName
    }).map(([k, v]) => `${k}=${v}`)
  );

  await writeLines(etcDir, "machine-id", host["machine-id"]);
  await writeLines(etcDir, "hostname", host.hostName);
}

export async function generateNetworkDefs(host, packageData) {
  const networkDir = join(packageData.dir, "etc/systemd/network");

  for (const ni of host.networkInterfaces.values()) {
    switch (ni.kind) {
      case "loopback":
        continue;
    }

    if (ni.name !== "eth0" && ni.hwaddr) {
      await writeLines(networkDir, `${ni.name}.link`, [
        sectionLines("Match", { MACAddress: ni.hwaddr }),
        "",
        sectionLines("Link", { Name: ni.name })
      ]);
    }

    const networkSections = [sectionLines("Match", { Name: ni.name })];

    for (const Address of ni.cidrAddresses) {
      networkSections.push(
        "",
        sectionLines("Address", {
          Address
        })
      );
    }

    switch (ni.kind) {
      case "ethernet":
      case "wlan":
        const routeSectionExtra = ni.destination
          ? { Destination: ni.destination }
          : { Gateway: ni.gatewayAddress };

        const networkSectionExtra = ni.arpbridge
          ? {
              IPForward: "yes",
              IPv4ProxyARP: "yes"
            }
          : {};

        networkSections.push(
          "",
          sectionLines("Network", {
            ...networkSectionExtra,
            DHCP: "no",
            DHCPServer: "no",
            MulticastDNS: ni.network.multicastDNS ? "yes" : "no",
            LinkLocalAddressing: "ipv6",
            IPv6LinkLocalAddressGenerationMode: "stable-privacy"
          }),
          "",
          sectionLines("Route", {
            ...routeSectionExtra,
            Scope: ni.scope,
            Metric: ni.metric,
            InitialCongestionWindow: 20,
            InitialAdvertisedReceiveWindow: 20
          }),
          "",
          sectionLines("IPv6AcceptRA", {
            UseAutonomousPrefix: "true",
            UseOnLinkPrefix: "true",
            DHCPv6Client: "false",
            Token: "eui64"
          })
        );

        if (ni.arpbridge) {
          networkSections.push(
            "",
            sectionLines("Link", { Promiscuous: "yes" })
          );
        }
    }

    await writeLines(networkDir, `${ni.name}.network`, networkSections);

    switch (ni?.kind) {
      case "wireguard":
        {
        }
        break;
      case "wifi": {
        const d = join(packageData.dir, "etc/wpa_supplicant");
        await mkdir(d, { recursive: true });
        writeFile(
          join(d, `wpa_supplicant-${ni.name}.conf`),
          `country=${host.location.country}
ctrl_interface=DIR=/run/wpa_supplicant GROUP=netdev
update_config=1
p2p_disabled=1
network={
  ssid="${ni.ssid}"
  psk=${ni.psk}
  scan_ssid=1
}`,
          "utf8"
        );

        addHook(
          packageData.properties.hooks,
          "post_install",
          `systemctl enable wpa_supplicant@${ni.name}.service`
        );
      }
    }
  }
}

export async function generateKnownHosts(hosts, dir) {
  const keys = [];
  for await (const host of hosts) {
    try {
      const [alg, key, desc] = (await host.publicKey("ed25519")).split(/\s+/);

      keys.push(`${host.domainName} ${alg} ${key}`);

      for await (const addr of host.networkAddresses()) {
        keys.push(`${addr.address} ${alg} ${key}`);
      }
    } catch {}
  }

  await writeLines(dir, "known_hosts", keys);
}
