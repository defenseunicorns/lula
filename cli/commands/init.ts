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
import prompt from 'prompts';
import { FrameworkResolver, FrameworkInfo } from '../frameworks/resolver';
import { AtomicProcessor } from '../processors/atomicProcessor';
import { AtomicImportOptions } from '../types/atomicControl';

export interface InitOptions {
	framework?: string;
	withCci?: boolean;
	projectName?: string;
	directory?: string;
	interactive?: boolean;
}

export class InitCommand {
	private frameworkResolver: FrameworkResolver;

	constructor() {
		this.frameworkResolver = new FrameworkResolver();
	}

	/**
	 * Run the init command
	 */
	async run(options: InitOptions): Promise<void> {
		console.log('🚀 Welcome to Lula Setup\n');

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
			console.log(`  npx tsx ../cli.ts serve .`);
			console.log(`\nOr run directly: npx tsx cli.ts serve "${projectConfig.directory}"`);
			console.log(`\nOpen http://localhost:3000 to start managing your controls.`);
		} catch (error) {
			console.error('❌ Setup failed:', error);
			process.exit(1);
		}
	}

	/**
	 * Run interactive setup with prompts
	 */
	private async runInteractiveSetup(options: InitOptions): Promise<ProjectConfig> {
		const frameworks = this.frameworkResolver.getFrameworksByCategory();
		
		// Build category choices
		const categoryChoices = Object.keys(frameworks).map(category => ({
			title: category,
			value: category,
			description: `${frameworks[category].length} framework${frameworks[category].length === 1 ? '' : 's'} available`
		}));

		// Run the interactive prompts in steps
		// First get project name
		const projectNameResponse = await prompt({
			type: 'text',
			name: 'projectName',
			message: 'What is your project name?',
			initial: options.projectName || 'my-compliance-project',
			validate: (value: string) => 
				value.length > 0 ? true : 'Project name cannot be empty',
			format: (value: string) => value.trim()
		});

		if (!projectNameResponse.projectName) {
			console.log('\n❌ Setup cancelled');
			process.exit(0);
		}

		// Then get the rest of the responses
		const responses = await prompt([
			{
				type: 'select',
				name: 'category',
				message: 'Choose a compliance framework category',
				choices: categoryChoices,
				initial: categoryChoices.findIndex(c => c.value === 'NIST 800-53 Rev 4') || 0
			},
			{
				type: 'select',
				name: 'framework',
				message: (prev: any) => `Choose a ${prev} framework`,
				choices: (prev: any) => {
					const selectedCategory = prev;
					const categoryFrameworks = frameworks[selectedCategory];
					
					if (!categoryFrameworks || !Array.isArray(categoryFrameworks)) {
						console.error(`No frameworks found for category: "${selectedCategory}"`);
						return [];
					}
					
					return categoryFrameworks.map((framework: FrameworkInfo) => ({
						title: `${framework.baseline} - ${framework.description}`,
						description: `Use case: ${framework.use_case}`,
						value: framework
					}));
				},
				initial: (prev: any) => {
					const selectedCategory = prev;
					if (!selectedCategory) return 0;
					
					const categoryFrameworks = frameworks[selectedCategory];
					if (!categoryFrameworks || !Array.isArray(categoryFrameworks)) return 0;
					
					const moderateIndex = categoryFrameworks.findIndex((f: FrameworkInfo) => f.id === 'nist-800-53-rev4-moderate');
					return moderateIndex >= 0 ? moderateIndex : 0;
				}
			},
			{
				type: 'confirm',
				name: 'withCci',
				message: 'Enable CCI (Control Correlation Identifier) tracking?',
				initial: true
			},
			{
				type: 'text',
				name: 'directory',
				message: 'Project directory',
				initial: options.directory || `./${projectNameResponse.projectName}`,
				validate: (value: string) => {
					const resolved = path.resolve(value);
					if (fs.existsSync(resolved) && fs.readdirSync(resolved).length > 0) {
						return 'Directory already exists and is not empty';
					}
					return true;
				}
			}
		], {
			onCancel: () => {
				console.log('\n❌ Setup cancelled');
				process.exit(0);
			}
		});

		// Combine the responses
		const allResponses = {
			projectName: projectNameResponse.projectName,
			...responses
		};

		return {
			projectName: allResponses.projectName,
			framework: allResponses.framework,
			withCci: allResponses.withCci,
			directory: path.resolve(allResponses.directory)
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
			withCci: options.withCci ?? true,
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
			`# Lula Project\n# Generated on ${new Date().toISOString()}\n\n` +
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

}

interface ProjectConfig {
	projectName: string;
	framework: FrameworkInfo;
	withCci: boolean;
	directory: string;
}
