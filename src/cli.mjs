import { parseArgs } from "node:util";
import { argv, cwd, env } from "node:process";
import { InitializationContext } from "./module.mjs";

export async function prepare(options = {}) {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      ...options,
      verbose: {
        type: "boolean",
        short: "v",
        default: false
      },
      dry: {
        type: "boolean",
        default: false
      },
      root: {
        type: "string",
        short: "r",
        default: env.PMCF_ROOT || cwd()
      }
    },
    allowPositionals: true
  });

  const ic = new InitializationContext(values.root);

  await ic.loadAll();

  return { ic, root: ic.root, options: values, args: positionals };
}
