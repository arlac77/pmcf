import { readFile, glob } from "node:fs/promises";
import { join } from "node:path";
import { Location } from "./location.mjs";
import { addType, types, resolveTypeLinks, typeFactory } from "./types.mjs";

const RootTypeDefinition = {
  name: "root",
  owners: [],
  priority: 1000,
  extends: Location.typeDefinition,
  properties: {}
};

export class Root extends Location {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return RootTypeDefinition;
  }

  constructor(directory) {
    resolveTypeLinks();
    super(undefined, "");
    this.directory = directory;
    this.addObject(this);
  }

  get fullName() {
    return "";
  }

  get root() {
    return this;
  }

  async _load(name, type) {
    const data = JSON.parse(
      await readFile(
        join(this.directory, name, type.clazz.typeFileName),
        "utf8"
      )
    );

    const parentName = name.replace(/\/[^\/]+$/, "");
    const owner = name === parentName ? this.root : await this.load(parentName);

    const fullName = this.fullName + "/" + name;
    data.name = fullName.substring(owner.fullName.length + 1);

    const object = typeFactory(type, owner, data);
    this.addTypeObject(type.clazz.typeName, name, object);
    return object;
  }

  async load(name, options) {
    name = name.replace(/\/([^\/]+\.json)?$/, "");

    const object = this.named(name);
    if (object) {
      return object;
    }

    if (options?.type) {
      return this._load(name, options.type);
    } else {
      for (const type of Object.values(types)) {
        try {
          return await this._load(name, type);
        } catch {}
      }
    }

    const parentName = name.replace(/\/[^\/]$/, "");
    return name === parentName ? this.root : this.load(parentName, options);
  }

  async loadAll() {
    for (const type of Object.values(types).sort(
      (a, b) => b.priority - a.priority
    )) {
      for await (const name of glob(type.clazz.fileNameGlob, {
        cwd: this.directory
      })) {
        await this.load(name, { type });
      }
    }

    this.execFinalize();
  }
}
