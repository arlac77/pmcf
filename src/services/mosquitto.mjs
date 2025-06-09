import { join } from "node:path";
import { FileContentProvider } from "npm-pkgbuild";
import { writeLines } from "../utils.mjs";
import { addType } from "../types.mjs";
import { Service, ServiceTypeDefinition } from "../service.mjs";

const MosquittoServiceTypeDefinition = {
  name: "mosquitto",
  specializationOf: ServiceTypeDefinition,
  owners: ServiceTypeDefinition.owners,
  extends: ServiceTypeDefinition,
  priority: 0.1,
  properties: {},
  service: {
    extends: ["mqtt"]
  }
};

export class MosquittoService extends Service {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return MosquittoServiceTypeDefinition;
  }

  constructor(owner, data) {
    super(owner, data);
    this.read(data, MosquittoServiceTypeDefinition);
  }

  get type() {
    return MosquittoServiceTypeDefinition.name;
  }

  async *preparePackages(dir) {
    const network = this.network;
    const host = this.host;
    const name = host.name;

    const packageData = {
      dir,
      sources: [new FileContentProvider(dir + "/")],
      outputs: this.outputs,
      properties: {
        name: `mosquitto-${this.location.name}-${host.name}`,
        description: `mosquitto definitions for ${this.fullName}@${name}`,
        access: "private",
        dependencies: ["mosquitto>=2.0.21"]
      }
    };

    const endpoint = this.endpoint("mqtt");

    const lines = [
      `listener ${endpoint.port}`,
      "log_timestamp false",
      "allow_anonymous true",
      "persistence_location /var/lib/mosquitto",
      "password_file /etc/mosquitto/passwd",
      "acl_file /etc/mosquitto/acl"
    ];

    await writeLines(join(dir, "etc", "mosquitto"), "mosquitto.conf", lines);

    yield packageData;
  }
}
