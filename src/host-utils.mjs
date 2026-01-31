import { writeLines } from "../src/utils.mjs";

export async function generateKnownHosts(hosts, dir) {
  const keys = [];
  for (const host of hosts) {
    try {
      const [alg, key, desc] = (await host.publicKey("ed25519")).split(/\s+/);

      for (const domainName of host.domainNames) {
        if (domainName !== "localhost") {
          keys.push(`${domainName} ${alg} ${key}`);
        }
      }

      for (const addr of host.networkAddresses(
        na => na.networkInterface.kind !== "loopback"
      )) {
        keys.push(`${addr.address} ${alg} ${key}`);
      }
    } catch {}
  }

  await writeLines(dir, "known_hosts", keys);
}
