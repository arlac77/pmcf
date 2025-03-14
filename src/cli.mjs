import { parseArgs } from "node:util";
import { argv, cwd, env } from "node:process";
import { Root } from "./module.mjs";

export async function prepare(options={}) {  
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
      publish: {
        type: "string",
      },
      root: {
        type: "string",
        short: "r",
        default: env.PMCF_ROOT || cwd()
      },
      output: {
        type: "string",
        short: "o"
      }
    },
    allowPositionals: true
  });

  const root = new Root(values.root);

  await root.loadAll();
  
  return { root, options: values, args: positionals };
}
