import { readFile, glob } from "node:fs/promises";
import { join } from "node:path";
import { Base } from "./base.mjs";
import { Location } from "./location.mjs";
import { addType, types } from "./types.mjs";

export class Root extends Location {
  static {
    addType(this);
  }

  static get typeDefinition() {
    return {
      name: "root",
      extends: Location,
      properties: {}
    };
  }

  constructor(directory) {
    super(undefined, { name: "" });
    this.directory = directory;
    this.addObject(this);
  }

  get fullName() {
    return "";
  }

  get root() {
    return this;
  }

  async load(name, options) {
    const fullName = Base.normalizeName(name);
    let object = this.named(fullName);
    if (object) {
      return object;
    }

    //console.log("LOAD", fullName);

    let path = fullName.split("/");
    path.pop();

    let data;
    let type = options?.type;
    if (type) {
      data = JSON.parse(
        await readFile(
          join(this.directory, fullName, type.typeFileName),
          "utf8"
        )
      );
    } else {
      for (type of types) {
        try {
          data = JSON.parse(
            await readFile(
              join(this.directory, fullName, type.typeFileName),
              "utf8"
            )
          );
          break;
        } catch {}
      }

      if (!data) {
        return this.load(path.join("/"), options);
      }
    }

    const owner = await this.load(path.join("/"));

    const length = owner.fullName.length;
    const n = fullName[length] === "/" ? length + 1 : length;
    data.name = fullName.substring(n);

    type = await type.prepareData(this, data);

    object = new type(owner, data);

    this._addObject(type.typeName, fullName, object);

    return object;
  }

  async loadAll() {
    for (let type of types) {
      for await (const name of glob(type.fileNameGlob, {
        cwd: this.directory
      })) {
        await this.load(name, { type });
      }
    }

    this.execFinalize();
  }
}
