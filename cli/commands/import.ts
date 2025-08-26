import { AtomicProcessor } from '../processors/atomicProcessor.js';
import { AtomicImportOptions } from '../types/atomicControl.js';
import * as path from 'path';

export interface ImportOptions {
	overwrite: boolean;
	dryRun: boolean;
	preserveOscal: boolean;
}

export interface ImportArgs {
	source: string;
	outputDir: string;
}

export class ImportCommand {
	private processor: AtomicProcessor;

	constructor() {
		this.processor = new AtomicProcessor();
	}

	async run(args: ImportArgs, options: ImportOptions): Promise<void> {
		try {
			console.log('🔄 Starting OSCAL import...');
			console.log(`📥 Source: ${args.source}`);
			console.log(`📤 Output: ${args.outputDir}`);

			const atomicOptions: AtomicImportOptions = {
				use_cci: true, // Use CCI by default for NIST frameworks
				output_dir: args.outputDir,
				overwrite: options.overwrite,
				dry_run: options.dryRun,
				flatten_references: !options.preserveOscal,
				include_links: options.preserveOscal,
				resolve_parameters: !options.preserveOscal,
				nist_revision_filter: '4' // Filter to Rev 4 only
			};

			// Handle URLs vs local files
			const sourceFilePath = await this.resolveSourceFile(args.source);

			try {
				const result = await this.processor.processOSCAL(sourceFilePath.path, atomicOptions);

				console.log('✅ OSCAL import completed successfully');
				console.log(`📊 Framework: ${result.framework.name} (${result.framework.version})`);
				console.log(`📊 Controls: ${result.controls.length}`);
			} finally {
				// Clean up temporary file if created
				await this.cleanupTempFile(sourceFilePath);
			}
		} catch (error) {
			console.error('❌ Error importing OSCAL:', error);
			throw error;
		}
	}

	private async resolveSourceFile(source: string): Promise<{ path: string; isTemp: boolean }> {
		if (source.startsWith('http://') || source.startsWith('https://')) {
			return await this.downloadSourceFile(source);
		}
		return { path: source, isTemp: false };
	}

	private async downloadSourceFile(url: string): Promise<{ path: string; isTemp: true }> {
		console.log(`📥 Fetching OSCAL file from ${url}...`);

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		const fileContent = await response.text();
		const fs = await import('fs');
		const os = await import('os');
		const tempFilePath = path.join(os.tmpdir(), `oscal-import-${Date.now()}.json`);

		await fs.promises.writeFile(tempFilePath, fileContent, 'utf8');
		return { path: tempFilePath, isTemp: true };
	}

	private async cleanupTempFile(sourceFile: { path: string; isTemp: boolean }): Promise<void> {
		if (sourceFile.isTemp) {
			try {
				const fs = await import('fs');
				await fs.promises.unlink(sourceFile.path);
			} catch (error) {
				// Ignore cleanup errors
				console.warn(`⚠️ Failed to cleanup temporary file: ${sourceFile.path}`);
			}
		}
	}
}
