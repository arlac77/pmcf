import {
  addType,
  string_attribute_writable,
  duration_attribute_writable
} from "pacc";
import {
  ExtraSourceService,
  ExtraSourceServiceTypeDefinition,
  ServiceTypeDefinition,
  serviceEndpoints,
  addServiceType
} from "pmcf";
import { filterConfigurable, sectionLines } from "../utils.mjs";

const SystemdTimesyncdServiceTypeDefinition = {
  name: "systemd-timesyncd",
  extends: ExtraSourceServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,

  attributes: {
    NTP: { ...string_attribute_writable, configurable: true },
    FallbackNTP: { ...string_attribute_writable, configurable: true },
    RootDistanceMaxSec: { ...duration_attribute_writable, configurable: true },
    PollIntervalMinSec: { ...duration_attribute_writable, configurable: true },
    PollIntervalMaxSec: { ...duration_attribute_writable, configurable: true },
    ConnectionRetrySec: { ...duration_attribute_writable, configurable: true },
    SaveIntervalSec: { ...duration_attribute_writable, configurable: true }
  },
  service: {
    systemdService: "systemd-timesyncd.service"
  }
};

export class SystemdTimesyncdService extends ExtraSourceService {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return SystemdTimesyncdServiceTypeDefinition;
  }

  get type() {
    return SystemdTimesyncdServiceTypeDefinition.name;
  }

  systemdConfigs(name) {
    const options = (lower, upper) => {
      return {
        services: `in("ntp",types) && priority >= ${lower} && priority <= ${upper}`,
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
      content: sectionLines(
        "Time",
        {
          NTP: serviceEndpoints(this, options(300, 399)),
          FallbackNTP: serviceEndpoints(this, options(100, 199)),
          ...this.getProperties(filterConfigurable)
        })
      
    };
  }
}
