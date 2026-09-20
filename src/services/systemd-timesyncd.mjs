import { string_attribute_writable, duration_attribute_writable } from "pacc";
import { ExtraSourceService, serviceEndpoints } from "pmcf";
import { sectionLines } from "../utils.mjs";
import { SCOPE_SYSTEMD_TIMESYNCD } from "../common-attributes.mjs";
import { addType } from "../type.mjs";

export class SystemdTimesyncdService extends ExtraSourceService {
  static name = "systemd-timesyncd";
  static attributes = {
    NTP: {
      ...string_attribute_writable,
      name: "NTP",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    },
    FallbackNTP: {
      ...string_attribute_writable,
      name: "FallbackNTP",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    },
    RootDistanceMaxSec: {
      ...duration_attribute_writable,
      name: "RootDistanceMaxSec",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    },
    PollIntervalMinSec: {
      ...duration_attribute_writable,
      name: "PollIntervalMinSec",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    },
    PollIntervalMaxSec: {
      ...duration_attribute_writable,
      name: "PollIntervalMaxSec",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    },
    ConnectionRetrySec: {
      ...duration_attribute_writable,
      name: "ConnectionRetrySec",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    },
    SaveIntervalSec: {
      ...duration_attribute_writable,
      name: "SaveIntervalSec",
      scope: SCOPE_SYSTEMD_TIMESYNCD
    }
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
        ...this.getAttributes(
          attribute => attribute.scope === SCOPE_SYSTEMD_TIMESYNCD
        )
      })
    };
  }
}
