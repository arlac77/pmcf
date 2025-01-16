import { parseArgs } from "node:util";
import { argv, cwd, env } from "node:process";
import { World } from "./model.mjs";

export function prepare() {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      world: {
        type: "string",
        short: "w",
        default: env.PMCF_WORLD || cwd()
      },
      output: {
        type: "string",
        short: "o",
        default: cwd()
      }
    },
    allowPositionals: true
  });

  const world = new World(values.world);

  return { world, options: values, args: positionals };
}
