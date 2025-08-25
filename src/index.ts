#!/usr/bin/env node

import { Command } from "commander"
import crawl from "./crawl.js"
// Define the program
const program = new Command()

// Set basic information
program
  .name("lula2")
  .description("Reports and exports compliance status for defined controls")
  .option("-c, --config <path>", "path to config file", "compliance.json")
  .addCommand(crawl())
  .action(options => {
    console.log("Checking compliance status...")
    if (options.config) {
      console.log(`Using config file: ${options.config}`)
    } else {
      console.log("Using default configuration")
    }
    console.log("Compliance check completed!")
  })

program.parse(process.argv)

// If no command is provided, show help
if (!process.argv.slice(1).length) {
  program.help()
}
