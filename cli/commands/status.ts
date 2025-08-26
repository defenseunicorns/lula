import * as path from 'path';

export interface StatusOptions {
	directory: string;
}

export interface StatusResult {
	directory: string;
	format: 'Valid' | 'Incomplete';
	hasControls: boolean;
	hasMetadata: boolean;
	hasControlSet: boolean;
	controlCounts: {
		total: number;
		families: number;
	};
	recommendation: string;
}

export class StatusCommand {
	async run(options: StatusOptions): Promise<StatusResult> {
		const fs = await import('fs');
		const fullPath = path.resolve(options.directory);

		if (!fs.existsSync(fullPath)) {
			throw new Error(`Directory not found: ${fullPath}`);
		}

		console.log(`🔍 Analyzing control set: ${fullPath}`);

		const analysis = await this.analyzeDirectory(fullPath, fs);
		const result = this.generateResult(fullPath, analysis);

		this.displayResults(result);
		return result;
	}

	private async analyzeDirectory(fullPath: string, fs: any) {
		const controlsDir = path.join(fullPath, 'controls');
		const metadataDir = path.join(fullPath, 'metadata');
		const controlSetYaml = path.join(fullPath, 'control-set.yaml');

		let hasControls = false;
		let totalControls = 0;
		let familyCount = 0;

		if (fs.existsSync(controlsDir)) {
			const controlsContent = fs.readdirSync(controlsDir);
			const familyDirectories = controlsContent.filter((f: string) =>
				fs.statSync(path.join(controlsDir, f)).isDirectory()
			);

			// Modern format: Individual YAML files organized in family subdirectories
			if (familyDirectories.length > 0) {
				for (const family of familyDirectories) {
					const familyDir = path.join(controlsDir, family);
					const controlFiles = fs.readdirSync(familyDir).filter((f: string) => f.endsWith('.yaml'));
					totalControls += controlFiles.length;
				}
				
				if (totalControls > 0) {
					hasControls = true;
					familyCount = familyDirectories.length;
				}
			}
		}

		return {
			hasControls,
			hasMetadata: fs.existsSync(metadataDir),
			hasControlSet: fs.existsSync(controlSetYaml),
			totalControls,
			familyCount
		};
	}

	private generateResult(fullPath: string, analysis: any): StatusResult {
		let format: StatusResult['format'];
		let recommendation: string;

		if (analysis.hasControls && analysis.hasMetadata && analysis.hasControlSet) {
			format = 'Valid';
			recommendation = 'Control set is properly structured and ready to use.';
		} else {
			format = 'Incomplete';
			const missing: string[] = [];
			if (!analysis.hasControls) missing.push('controls');
			if (!analysis.hasMetadata) missing.push('metadata');  
			if (!analysis.hasControlSet) missing.push('control-set.yaml');
			recommendation = `Incomplete structure. Missing: ${missing.join(', ')}. Use 'import' command to create a proper control set.`;
		}

		return {
			directory: fullPath,
			format,
			hasControls: analysis.hasControls,
			hasMetadata: analysis.hasMetadata,
			hasControlSet: analysis.hasControlSet,
			controlCounts: {
				total: analysis.totalControls,
				families: analysis.familyCount
			},
			recommendation
		};
	}

	private displayResults(result: StatusResult): void {
		console.log('\n📋 Structure Analysis:');
		console.log(`   Controls: ${result.hasControls ? '✅ Present' : '❌ Missing'}`);
		console.log(`   Metadata: ${result.hasMetadata ? '✅ Present' : '❌ Missing'}`);
		console.log(`   Control set config: ${result.hasControlSet ? '✅ Present' : '❌ Missing'}`);

		console.log(`\n🏷️  Status: ${result.format}`);
		console.log(`💡 ${result.recommendation}`);

		// Display control counts if valid
		if (result.format === 'Valid') {
			console.log(`📊 Controls: ${result.controlCounts.total} across ${result.controlCounts.families} families`);
		}
	}
}
