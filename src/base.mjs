import { join } from "node:path";
import { stat } from "node:fs/promises";
import {
  createExpressionTransformer,
  transform
} from "content-entry-transform";
import { FileContentProvider } from "npm-pkgbuild";
import {
  parse,
  globals,
  extract,
  extendingAttributeIterator,
  name_attribute_writable,
  type_attribute_writable,
  string_attribute_writable,
  string_set_attribute_writable,
  description_attribute_writable,
  boolean_attribute_writable,
  default_attribute_writable
} from "pacc";
import { union } from "./utils.mjs";
import { addType, core } from "pmcf";
import { owner_attribute, aliases_attribute } from "./common-attributes.mjs";

/**
 *
 * attributes: as declared in the types
 * properties: use defined values to support attribute value definitions
 */
export class base extends core {
  static key = "name";
  static priority = 0;
  static attributes = {
    template: {
      ...boolean_attribute_writable,
      name: "template",
      private: true
    },
    owner: owner_attribute,
    name: name_attribute_writable,
    aliases: aliases_attribute,
    description: description_attribute_writable,
    type: type_attribute_writable,
    directory: { ...string_attribute_writable, name: "directory" },
    enabled: { ...boolean_attribute_writable, name: "enabled" },
    tags: { ...string_set_attribute_writable, name: "tags" },
    content: { ...default_attribute_writable, type: "content", name: "content" }
  };

  static {
    addType(this);
  }

  static get fileName() {
    return this.name + ".json";
  }

  description;
  name;
  properties = {};
  _aliases = new Set();
  _tags = new Set();
  _directory;

  value(name) {
    return this.attribute(name) ?? this.property(name) ?? this.named(name);
  }

  materializeExtends() {
    super.materializeExtends();
    if (this.content) {
      for (const e of this.extends) {
        if (e.content) {
          this.content.extends.add(e.content);
        }
      }
    }
  }

  named(name) {
    if (name[0] === "/") {
      return this.root.named(name.substring(1));
    }

    const parts = name.split("/");
    const first = parts.shift();

    for (const [path, attribute] of extendingAttributeIterator(
      this.constructor,
      attribute => !attribute.type.primitive
    )) {
      const value = this[path];
      if (typeof value?.get === "function") {
        const object = value.get(first);
        if (object) {
          return parts.length === 0 ? object : object.named(parts.join("/"));
        }
      }
    }
  }

  get host() {
    return this.owner?.host;
  }

  get network() {
    return this.owner?.network;
  }

  get domain() {
    return this.owner?.domain;
  }

  get domains() {
    return this.owner?.domains ?? new Set();
  }

  get localDomains() {
    return this.owner?.localDomains ?? new Set();
  }

  get administratorEmail() {
    return this.owner?.administratorEmail;
  }

  get locales() {
    return this.owner?.locales;
  }

  get country() {
    return this.owner?.country;
  }

  get timezone() {
    return this.owner?.timezone;
  }

  /**
   * @return {boolean}
   */
  get enabled() {
    return this.attribute("_enabled") ?? true;
  }

  set enabled(value) {
    this._enabled = value;
  }

  get tags() {
    return this.unionFromDirections(["this", "extends"], "_tags");
  }

  set tags(value) {
    this._tags = union(value, this._tags);
  }

  set aliases(value) {
    this._aliases = union(value, this._aliases);
  }

  get aliases() {
    return this.expand(
      this.unionFromDirections(["this", "extends"], "_aliases")
    );
  }

  set priority(value) {
    this._priority = value;
  }

  /**
   * @return {number}
   */
  get priority() {
    return this._priority ?? this.owner?.priority;
  }

  get smtp() {
    return this.expression("services[types[smtp]][0]");
  }

  get services() {
    return this.owner?.services || new Map();
  }

  set directory(directory) {
    this._directory = directory;
  }

  get directory() {
    return (
      this._directory ??
      (this.owner?.directory
        ? join(this.owner.directory, this.name)
        : this.name)
    );
  }

  get fullName() {
    return this.owner ? join(this.owner.fullName, "/", this.name) : this.name;
  }

  get systemUserName() {
    return this.constructor.name;
  }

  get systemGroupName() {
    return this.constructor.name;
  }

  get packageData() {
    if (!this.content) {
      for (const e of this.walkDirections(["extends"])) {
        if (e.content) {
          this.content = e.content.forOwner(this);
          break;
        }
      }
    }
    return this.content?.packageData();
  }

  async *preparePackages(stagingDir) {
    const pd = await this.packageData;

    pd.sources.push(...(await Array.fromAsync(this.templateContent())));

    if (pd.sources.length) {
      yield pd;
    }
  }

  get templateTransformers() {
    return [
      createExpressionTransformer(
        e => e.isBlob,
        expression =>
          parse(expression, {
            root: this.root,
            current: this,
            valueFor: (name, at) =>
              typeof at?.value === "function" ? at.value(name) : globals[name]
          })
      )
    ];
  }

  /**
   *
   * @param {string} dir
   * @returns {Object}
   */
  templateContentAttributes(dir) {
    return { dir, pattern: "**/*", permissions: this.content?.permissions };
  }

  /**
   *
   * @returns {AsyncIterable<ContentProvider>}
   */
  async *templateContent() {
    for (const node of this.walkDirections(["this", "extends"])) {
      const dir = join(node.directory, "content");

      try {
        if ((await stat(dir)).isDirectory) {
          yield transform(
            new FileContentProvider(this.templateContentAttributes(dir)),
            this.templateTransformers
          );
        }
      } catch (e) {
        if (e.code !== "ENOENT") {
          throw e;
        }
      }
    }
  }

  /**
   * @return {boolean}
   */
  get isTemplate() {
    return this.template ?? (super.isTemplate || this.name?.indexOf("*") >= 0);
  }

  error(...args) {
    console.error(`${this.toString()}:`, ...args);
  }

  info(...args) {
    console.info(`${this.toString()}:`, ...args);
  }

  toString() {
    return `${this.fullName}(${this.typeName})`;
  }

  toJSON() {
    return extract(this);
  }
}
