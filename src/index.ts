#!/usr/bin/env node

import { Command } from "commander";
import crawl from "./crawl.js";
import fs from "fs";
import path from "path";

const program = new Command();
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the current version from package.json
 *
 * @returns The current version
 */
export function getVersion() {
  const pkgPath = path.resolve(__dirname, "../package.json"); // adjust path if index.ts is in src/
  const packageJson = fs.readFileSync(pkgPath, "utf8");
  const { version } = JSON.parse(packageJson);
  return version;
}

program
  .name("lula2")
  .description("Reports and exports compliance status for defined controls")
  .version(getVersion(), "-v, --version", "output the current version")
  .option("-c, --config <path>", "path to config file", "compliance.json")
  .addCommand(crawl())
  .action(options => {
    console.log("Checking compliance status...");
    if (options.config) {
      console.log(`Using config file: ${options.config}`);
    } else {
      console.log("Using default configuration");
    }
    console.log("Compliance check completed!");
  });

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(1).length) {
  program.help();
}
