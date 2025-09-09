#!/usr/bin/env node

import { Command } from 'commander';
import { UICommand } from './cli/commands/ui';
import { getVersion } from './cli/commands/version';
import { crawlCommand } from './cli/commands/crawl';
const program = new Command();

program
	.name('lula2')
	.description('Lula - Git-friendly compliance control management')
	.version(getVersion(), '-v, --version', 'output the current version')
	.option('--debug', 'Enable debug logging');

// Register commands
UICommand.register(program, () => program.opts().debug || false);
program.addCommand(crawlCommand());

program.parse(process.argv);
