import { string_attribute_writable, duration_attribute_writable } from "pacc";
import { ExtraSourceService, Service, serviceEndpoints, addType } from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

export class SystemdTimesyncdService extends ExtraSourceService {
  static name = "systemd-timesyncd";
  static specializationOf = Service;

  static attributes = {
    NTP: { ...string_attribute_writable, name: "NTP", configurable: true },
    FallbackNTP: { ...string_attribute_writable, name: "FallbackNTP", configurable: true },
    RootDistanceMaxSec: { ...duration_attribute_writable, name: "RootDistanceMaxSec",configurable: true },
    PollIntervalMinSec: { ...duration_attribute_writable, name: "PollIntervalMinSec",configurable: true },
    PollIntervalMaxSec: { ...duration_attribute_writable, name: "PollIntervalMaxSec",configurable: true },
    ConnectionRetrySec: { ...duration_attribute_writable, name: "ConnectionRetrySec",configurable: true },
    SaveIntervalSec: { ...duration_attribute_writable, name: "SaveIntervalSec", configurable: true }
  };
  static service = {
    systemdService: "systemd-timesyncd.service"
  };

  static {
    addType(this);
  }

  systemdConfigs(name) {
    const options = (lower, upper) => {
      return {
        // TODO types[ntp]
        services: `services[in("ntp",types) && priority >= ${lower} && priority <= ${upper}]`,
        endpoints: e =>
          e.networkInterface && e.networkInterface.kind !== "loopback",
        select: endpoint => endpoint.address,
        join: " ",
        limit: 2
      };
    };

    return {
      serviceName: this.systemdService,
      configFileName: `etc/systemd/timesyncd.conf.d/${name}.conf`,
      content: sectionLines("Time", {
        NTP: serviceEndpoints(this, options(300, 399)),
        FallbackNTP: serviceEndpoints(this, options(100, 199)),
        ...this.getAttributes(filterConfigurable)
      })
    };
  }
}
