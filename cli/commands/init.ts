// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Interactive Init Command
 *
 * Creates a new compliance project with guided framework selection.
 * Similar to create-react-app, nx, or other scaffolding tools.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { FrameworkResolver, FrameworkInfo } from '../frameworks/resolver.js';
import { AtomicProcessor } from '../processors/atomicProcessor.js';
import { AtomicImportOptions } from '../types/atomicControl.js';

export interface InitOptions {
	framework?: string;
	withCci?: boolean;
	projectName?: string;
	directory?: string;
	interactive?: boolean;
}

export class InitCommand {
	private frameworkResolver: FrameworkResolver;
	private rl: readline.Interface;

	constructor() {
		this.frameworkResolver = new FrameworkResolver();
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
	}

	/**
	 * Run the init command
	 */
	async run(options: InitOptions): Promise<void> {
		console.log('🚀 Welcome to Compliance Manager Setup\n');

		try {
			let projectConfig;

			if (options.interactive !== false) {
				projectConfig = await this.runInteractiveSetup(options);
			} else {
				projectConfig = await this.runNonInteractiveSetup(options);
			}

			await this.createProject(projectConfig);

			console.log('\n✅ Project setup complete!');
			console.log(`\nNext steps:`);
			console.log(`  cd ${projectConfig.directory}`);
			console.log(`  npx tsx ../cli.ts serve`);
			console.log(`\nOpen http://localhost:3000 to start managing your controls.`);
		} catch (error) {
			console.error('❌ Setup failed:', error);
			process.exit(1);
		} finally {
			this.rl.close();
		}
	}

	/**
	 * Run interactive setup with prompts
	 */
	private async runInteractiveSetup(options: InitOptions): Promise<ProjectConfig> {
		const frameworks = this.frameworkResolver.getFrameworksByCategory();

		// Project name
		const projectName =
			options.projectName ||
			(await this.askQuestion('What is your project name? ', 'my-compliance-project'));

		// Framework selection
		console.log('\n📋 Available Compliance Frameworks:\n');

		const frameworkChoices: FrameworkInfo[] = [];
		let choiceIndex = 1;

		Object.entries(frameworks).forEach(([category, categoryFrameworks]) => {
			console.log(`${category}:`);
			categoryFrameworks.forEach((framework) => {
				console.log(`  ${choiceIndex}. ${framework.baseline} - ${framework.description}`);
				console.log(`     Use case: ${framework.use_case}`);
				frameworkChoices.push(framework);
				choiceIndex++;
			});
			console.log('');
		});

		const frameworkChoice = await this.askQuestion(
			`Select a framework (1-${frameworkChoices.length}): `,
			'2' // Default to NIST 800-53 Rev 4 Moderate
		);

		const selectedFramework = frameworkChoices[parseInt(frameworkChoice) - 1];
		if (!selectedFramework) {
			throw new Error('Invalid framework selection');
		}

		// CCI recommendation
		const cciDefault = selectedFramework.recommended_cci ? 'y' : 'n';
		const withCci = await this.askYesNo(
			`Enable CCI-level tracking? (Recommended for NIST frameworks) [${cciDefault.toUpperCase()}/n]: `,
			selectedFramework.recommended_cci
		);

		// Directory selection
		const directory =
			options.directory || (await this.askQuestion('Project directory: ', `./${projectName}`));

		return {
			projectName,
			framework: selectedFramework,
			withCci,
			directory: path.resolve(directory)
		};
	}

	/**
	 * Run non-interactive setup with provided options
	 */
	private async runNonInteractiveSetup(options: InitOptions): Promise<ProjectConfig> {
		const frameworkId = options.framework || 'nist-800-53-rev4-moderate';
		const framework = this.frameworkResolver.getFramework(frameworkId);

		if (!framework) {
			throw new Error(`Unknown framework: ${frameworkId}`);
		}

		return {
			projectName: options.projectName || 'compliance-project',
			framework,
			withCci: options.withCci ?? framework.recommended_cci,
			directory: path.resolve(options.directory || './compliance-project')
		};
	}

	/**
	 * Create the project structure and import controls
	 */
	private async createProject(config: ProjectConfig): Promise<void> {
		console.log(`\n🔧 Setting up project: ${config.projectName}`);
		console.log(`Framework: ${config.framework.name} ${config.framework.baseline}`);
		console.log(`CCI Tracking: ${config.withCci ? 'Enabled' : 'Disabled'}`);
		console.log(`Directory: ${config.directory}`);

		// Create directory structure
		if (!fs.existsSync(config.directory)) {
			fs.mkdirSync(config.directory, { recursive: true });
		}

		// Check if framework file exists
		const frameworkPath = this.frameworkResolver.getFrameworkPath(config.framework.id);
		if (!frameworkPath || !fs.existsSync(frameworkPath)) {
			throw new Error(`Framework file not found: ${config.framework.file_path}`);
		}

		console.log('\n📥 Importing controls...');

		// Import controls using AtomicProcessor
		const processor = new AtomicProcessor();
		const atomicOptions: AtomicImportOptions = {
			use_cci: config.withCci,
			output_dir: config.directory,
			overwrite: true,
			dry_run: false,
			flatten_references: true,
			include_links: false,
			resolve_parameters: true, // Enable simple mode by default
			nist_revision_filter: '4' // Default to NIST Rev 4
		};

		const result = await processor.processOSCAL(frameworkPath, atomicOptions);

		// Create project metadata file
		const projectMetadata = {
			name: config.projectName,
			framework: {
				id: config.framework.id,
				name: config.framework.name,
				version: config.framework.version,
				baseline: config.framework.baseline
			},
			cci_enabled: config.withCci,
			created_at: new Date().toISOString(),
			created_by: 'compliance-manager-cli'
		};

		fs.writeFileSync(
			path.join(config.directory, 'project.yaml'),
			`# Compliance Manager Project\n# Generated on ${new Date().toISOString()}\n\n` +
				`name: ${projectMetadata.name}\n` +
				`framework:\n` +
				`  id: ${projectMetadata.framework.id}\n` +
				`  name: "${projectMetadata.framework.name}"\n` +
				`  version: ${projectMetadata.framework.version}\n` +
				`  baseline: ${projectMetadata.framework.baseline}\n` +
				`cci_enabled: ${projectMetadata.cci_enabled}\n` +
				`created_at: ${projectMetadata.created_at}\n` +
				`created_by: ${projectMetadata.created_by}\n`
		);

		console.log(`✅ Imported ${result.controls.length} controls`);
		if (config.withCci) {
			const cciCount = result.controls.filter((c) => c.type === 'cci').length;
			console.log(`   - ${cciCount} CCI-level controls`);
		}
	}

	/**
	 * Ask a question and return the answer
	 */
	private askQuestion(question: string, defaultValue?: string): Promise<string> {
		return new Promise((resolve) => {
			this.rl.question(question, (answer) => {
				resolve(answer.trim() || defaultValue || '');
			});
		});
	}

	/**
	 * Ask a yes/no question
	 */
	private askYesNo(question: string, defaultValue: boolean = false): Promise<boolean> {
		return new Promise((resolve) => {
			this.rl.question(question, (answer) => {
				const normalized = answer.trim().toLowerCase();
				if (normalized === 'y' || normalized === 'yes') {
					resolve(true);
				} else if (normalized === 'n' || normalized === 'no') {
					resolve(false);
				} else {
					resolve(defaultValue);
				}
			});
		});
	}
}

interface ProjectConfig {
	projectName: string;
	framework: FrameworkInfo;
	withCci: boolean;
	directory: string;
}
