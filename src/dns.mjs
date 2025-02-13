import { Base } from "./base.mjs";
import { asArray } from "./utils.mjs";
import { addType } from "./types.mjs";

export class DNSService extends Base {
  allowedUpdates = [];
  recordTTL = "1W";
  soaUpdates = [36000, 72000, 600000, 60000];
  hasSVRRecords = true;
  hasCatalog = true;

  forwardsTo = [];

  static {
    addType(this);
  }

  static get typeName() {
    return "dns";
  }

  constructor(owner, data) {
    super(owner, data);
    Object.assign(this, data);
    owner.addObject(this);
  }

  async *services() {
    const filter = { type: "dns" };

    yield* this.owner.services(filter);

    for (const s of asArray(this.forwardsTo)) {
      const owner = await this.owner.root.load(s);
      yield* owner.services(filter);
    }
  }

  get domains() {
    return [this.owner.domain];
  }

  get propertyNames() {
    return [
      "recordTTL",
      "soaUpdates",
      "hasSVRRecords",
      "hasCatalog",
      "forwardsTo",
      "allowedUpdates"
    ];
  }

  async resolvedConfig() {
    const dnsServices = (await Array.fromAsync(this.services())).sort(
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
