import { Base } from "./base.mjs";
import { asArray } from "./utils.mjs";

export class DNSService extends Base {
  allowedUpdates = [];
  recordTTL = "1W";
  forwardsTo = [];

  static get typeName() {
    return "dns";
  }

  constructor(owner, data) {
    super(owner, data);
    Object.assign(this, data);
  }

  async *services() {
    const filter = { type: "dns" };

    yield* this.owner.services(filter);

    for (const s of asArray(this.forwardsTo)) {
      const owner = await this.owner.world.load(s);
      yield* owner.services(filter);
    }
  }

  get domains() {
    return [this.owner.domain];
  }

  get propertyNames() {
    return ["recordTTL", "forwardsTo", "allowedUpdates"];
  }
}
