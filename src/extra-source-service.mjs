import { AggregatedMap } from "aggregated-map";
import { default_collection_attribute_writable, addType } from "pacc";
import { CoreService } from "./core-service.mjs";
import { networkAddressType } from "pmcf";

export class ExtraSourceService extends CoreService {
  static name = "extra-source-service";
  static attributes = {
    source: {
      ...default_collection_attribute_writable,
      name: "source",
      type: networkAddressType
    }
  };

  static {
    addType(this);
  }

  source = [];

  get services() {
    return new AggregatedMap([
      this.owner.owner.services,
      ...this.source.map(s => s.services)
    ]);
  }
}
