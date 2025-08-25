import * as path from 'path';

export interface StatusOptions {
  directory: string;
}

export interface StatusResult {
  directory: string;
  format: 'Enriched Format' | 'Legacy Format' | 'Unknown/Incomplete';
  hasEnrichedControls: boolean;
  hasLegacyControls: boolean;
  hasMetadata: boolean;
  hasControlSet: boolean;
  controlCounts: {
    enriched?: number;
    legacy?: number;
    families?: number;
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
    
    let hasEnrichedControls = false;
    let hasLegacyControls = false;
    let enrichedCount = 0;
    let legacyCount = 0;
    let familyCount = 0;

    if (fs.existsSync(controlsDir)) {
      const controlsContent = fs.readdirSync(controlsDir);
      const yamlFiles = controlsContent.filter((f: string) => f.endsWith('.yaml'));
      const subdirs = controlsContent.filter((f: string) => 
        fs.statSync(path.join(controlsDir, f)).isDirectory()
      );
      
      hasEnrichedControls = yamlFiles.length > 0 && subdirs.length === 0;
      hasLegacyControls = subdirs.length > 0 && yamlFiles.length === 0;
      
      if (hasEnrichedControls) {
        enrichedCount = yamlFiles.length;
      }
      
      if (hasLegacyControls) {
        familyCount = subdirs.length;
        for (const family of subdirs) {
          const familyDir = path.join(controlsDir, family);
          const controlFiles = fs.readdirSync(familyDir).filter((f: string) => f.endsWith('.yaml'));
          legacyCount += controlFiles.length;
        }
      }
    }
    
    return {
      hasEnrichedControls,
      hasLegacyControls,
      hasMetadata: fs.existsSync(metadataDir),
      hasControlSet: fs.existsSync(controlSetYaml),
      enrichedCount,
      legacyCount,
      familyCount
    };
  }

  private generateResult(fullPath: string, analysis: any): StatusResult {
    let format: StatusResult['format'];
    let recommendation: string;
    
    if (analysis.hasEnrichedControls && analysis.hasMetadata) {
      format = 'Enriched Format';
      recommendation = analysis.hasLegacyControls 
        ? 'Mixed format detected. Legacy structure should be migrated or removed.'
        : 'Control set is using modern enriched format.';
    } else if (analysis.hasLegacyControls && analysis.hasControlSet) {
      format = 'Legacy Format';
      recommendation = 'Consider migrating to enriched format using: import --with-cci=true command';
    } else {
      format = 'Unknown/Incomplete';
      recommendation = 'Directory structure is incomplete or unrecognized.';
    }

    return {
      directory: fullPath,
      format,
      hasEnrichedControls: analysis.hasEnrichedControls,
      hasLegacyControls: analysis.hasLegacyControls,
      hasMetadata: analysis.hasMetadata,
      hasControlSet: analysis.hasControlSet,
      controlCounts: {
        enriched: analysis.enrichedCount || undefined,
        legacy: analysis.legacyCount || undefined,
        families: analysis.familyCount || undefined
      },
      recommendation
    };
  }

  private displayResults(result: StatusResult): void {
    console.log('\n📋 Structure Analysis:');
    console.log(`   Enriched controls: ${result.hasEnrichedControls ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Framework metadata: ${result.hasMetadata ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Legacy structure: ${result.hasLegacyControls ? '⚠️  Present' : '✅ Not present'}`);
    console.log(`   Control set config: ${result.hasControlSet ? '✅ Present' : '❌ Missing'}`);
    
    console.log(`\n🏷️  Format: ${result.format}`);
    console.log(`💡 Recommendation: ${result.recommendation}`);
    
    // Display control counts
    if (result.controlCounts.enriched) {
      console.log(`📊 Enriched controls: ${result.controlCounts.enriched}`);
    }
    
    if (result.controlCounts.legacy) {
      console.log(`📊 Legacy controls: ${result.controlCounts.legacy} across ${result.controlCounts.families} families`);
    }
  }
}