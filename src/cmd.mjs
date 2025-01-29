import { parseArgs } from "node:util";
import { argv, cwd, env } from "node:process";
import { Root } from "./model.mjs";

export async function prepare() {  
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      root: {
        type: "string",
        short: "r",
        default: env.PMCF_ROOT || cwd()
      },
      output: {
        type: "string",
        short: "o",
        default: cwd()
      }
    },
    allowPositionals: true
  });

  const root = new Root(values.root);

  await root.loadAll();
  
  return { root, options: values, args: positionals };
}
