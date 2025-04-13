import { join } from "node:path";
import { writeLines } from "../src/utils.mjs";

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
