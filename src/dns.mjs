import { Base } from "./base.mjs";
import { addType } from "./types.mjs";

const DNSServiceTypeDefinition = {
  name: "dns",
  owners: ["location", "owner", "network", "cluster", "root"],
  priority: 0.1,
  properties: {
    hasSVRRecords: { type: "boolean", collection: false, writeable: true },
    hasCatalog: { type: "boolean", collection: false, writeable: true },
    recordTTL: { type: "string", collection: false, writeable: true },
    soaUpdates: { type: "number", collection: true, writeable: true },
    forwardsTo: { type: "network", collection: true, writeable: true },
    allowedUpdates: { type: "string", collection: true, writeable: true }
  }
};

export class DNSService extends Base {
  allowedUpdates = [];
  recordTTL = "1W";
  soaUpdates = [36000, 72000, 600000, 60000];
  hasSVRRecords = true;
  hasCatalog = true;
  #forwardsTo = [];

  static {
    addType(this);
  }

  static get typeDefinition() {
    return DNSServiceTypeDefinition;
  }

  constructor(owner, data) {
    if (!data.name) {
      data.name = DNSServiceTypeDefinition.name; // TODO
    }
    super(owner, data);
    this.read(data, DNSServiceTypeDefinition);
  }

  set forwardsTo(value) {
    this.#forwardsTo.push(value);
  }

  get forwardsTo() {
    return this.#forwardsTo;
  }

  async *findServices() {
    const filter = { type: DNSServiceTypeDefinition.name };

    yield* this.owner.findServices(filter);

    for (const s of this.forwardsTo) {
      yield* s.findServices(filter);
    }
  }

  get domains() {
    return [this.owner.domain];
  }

  async resolvedConfig() {
    const dnsServices = (await Array.fromAsync(this.findServices())).sort(
      (a, b) => a.priority - b.priority
    );

    const master = dnsServices
      .filter(s => s.priority < 10)
      .map(s => s.ipAddresses)
      .flat();
    const fallback = dnsServices
      .filter(s => s.priority >= 10)
      .map(s => s.ipAddresses)
      .flat();

    return {
      DNS: master.join(" "),
      FallbackDNS: fallback.join(" "),
      Domains: this.domains.join(" "),
      DNSSEC: "no",
      MulticastDNS: "yes",
      LLMNR: "no"
    };
  }
}
