import { FileContentProvider } from "npm-pkgbuild";
import { addType } from "pacc";
import { addServiceType } from "pmcf";
import { ServiceTypeDefinition, Service } from "../service.mjs";

const PostfixServiceTypeDefinition = {
  name: "postfix",
  extends: ServiceTypeDefinition,
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  key: "name",
  attributes: {},
  service: {
    systemdService: "postfix.service",
    extends: ["smtp", "lmpt", "submission"],
    services: {}
  }
};

export class PostfixService extends Service {
  static {
    addType(this);
    addServiceType(this.typeDefinition.service, this.typeDefinition.name);
  }

  static get typeDefinition() {
    return PostfixServiceTypeDefinition;
  }

  get type() {
    return PostfixServiceTypeDefinition.name;
  }

  async *preparePackages(dir) {
    const owner = "root";
    const group = "root";

    const entryProperties = {
      mode: 0o644,
      owner,
      group
    };
    const directoryProperties = {
      mode: 0o755,
      owner,
      group
    };

    const packageData = {
      sources: [
        ...this.templateContent(entryProperties, directoryProperties),
        new FileContentProvider(dir + "/", entryProperties, directoryProperties)
      ],
      outputs: this.outputs,
      properties: {
        name: `${this.typeName}-${this.location.name}-${this.host.name}`,
        description: `${this.typeName} definitions for ${this.fullName}@${this.host.name}`,
        access: "private",
        dependencies: ["postfix>=3.10.7"]
      }
    };

    yield packageData;
  }
}
