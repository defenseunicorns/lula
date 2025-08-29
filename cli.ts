#!/usr/bin/env node

import { program } from 'commander';
import { ServeCommand } from './cli/commands/serve';
import { StatusCommand } from './cli/commands/status';

// CLI setup
program
  .name('lula')
  .description('Lula - Git-friendly compliance control management')
  .version('1.0.0');


// Serve command - start the web server
program
  .command('serve [directory]')
  .description('Start the web server with control management and import wizard')
  .option('--dir <directory>', 'Control set directory path (alternative to positional argument)')
  .option('--port <port>', 'Server port', '3000')
  .action(async (directory: string | undefined, options) => {
    const serveCommand = new ServeCommand();
    const controlSetDir = directory || options.dir || process.cwd();
    await serveCommand.run({
      dir: controlSetDir,
      port: parseInt(options.port),
      openBrowser: false // Always open browser
    });
  });

// Status command - check if a control set uses enriched format
program
  .command('status')
  .description('Check the format and structure of a control set')
  .argument('<dir>', 'Control set directory path')
  .action(async (dir: string) => {
    try {
      const statusCommand = new StatusCommand();
      await statusCommand.run({ directory: dir });
    } catch (error) {
      console.error('❌ Error analyzing control set:', error);
      process.exit(1);
    }
  });

// For backward compatibility, if no command is specified, run serve
const knownCommands = ['serve', 'status'];
const hasKnownCommand = knownCommands.some((cmd) => process.argv.includes(cmd));
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');

if ((process.argv.length === 2 || !hasKnownCommand) && !hasHelpFlag) {
  process.argv.splice(2, 0, 'serve');
}

program.parse();
