// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Frameworks Command
 * 
 * Lists available bundled compliance frameworks and their details.
 */

import { FrameworkResolver } from '../frameworks/resolver.js';

export class FrameworksCommand {
  private frameworkResolver: FrameworkResolver;

  constructor() {
    this.frameworkResolver = new FrameworkResolver();
  }

  /**
   * Run the frameworks command
   */
  async run(options: { verbose?: boolean } = {}): Promise<void> {
    console.log('📋 Available Compliance Frameworks\n');

    const frameworksByCategory = this.frameworkResolver.getFrameworksByCategory();
    
    Object.entries(frameworksByCategory).forEach(([category, frameworks]) => {
      if (frameworks.length === 0) return;
      
      console.log(`${category}:`);
      frameworks.forEach(framework => {
        const available = this.frameworkResolver.isFrameworkAvailable(framework.id);
        const status = available ? '✅' : '❌';
        
        console.log(`  ${status} ${framework.id}`);
        console.log(`     Name: ${framework.name} ${framework.baseline || ''}`);
        console.log(`     Description: ${framework.description}`);
        
        if (options.verbose) {
          console.log(`     Version: ${framework.version}`);
          console.log(`     Use case: ${framework.use_case}`);
          console.log(`     CCI recommended: ${framework.recommended_cci ? 'Yes' : 'No'}`);
          console.log(`     File: ${framework.file_path}`);
        }
        
        if (!available) {
          console.log(`     ⚠️  Framework file not found - check git submodules`);
        }
        
        console.log('');
      });
    });

    if (options.verbose) {
      this.showUsageExamples();
    } else {
      console.log('Use --verbose for more details and usage examples.');
    }
  }

  private showUsageExamples(): void {
    console.log('\n📚 Usage Examples:\n');
    
    console.log('Interactive setup (recommended):');
    console.log('  npx tsx cli.ts init\n');
    
    console.log('Quick setup with specific framework:');
    console.log('  npx tsx cli.ts init --framework=nist-800-53-rev4-moderate --project-name=my-project\n');
    
    console.log('Import controls directly:');
    console.log('  npx tsx cli.ts import ./my-controls --framework=nist-800-53-rev4-high --with-cci');
    console.log('  npx tsx cli.ts import ./my-controls --framework=nist-800-53-rev4-high --preserve-oscal  # Keep OSCAL structure\n');
    
    console.log('Common framework choices:');
    console.log('  • nist-800-53-rev4-moderate - Most common choice for federal systems');
    console.log('  • nist-800-53-rev4-high - High-security federal systems');
    console.log('  • fedramp-moderate - FedRAMP cloud services');
    console.log('  • nist-800-53-rev5-moderate - Latest revision (if available)');
  }

  /**
   * Get framework recommendations based on use case
   */
  getRecommendations(useCase?: string): void {
    console.log('\n💡 Framework Recommendations:\n');

    const recommendations = [
      {
        scenario: 'Most federal/government systems',
        framework: 'nist-800-53-rev4-moderate',
        reason: 'Balanced security controls, widely accepted'
      },
      {
        scenario: 'High-security environments (defense, intelligence)',
        framework: 'nist-800-53-rev4-high',
        reason: 'Comprehensive controls for high-risk systems'
      },
      {
        scenario: 'FedRAMP cloud service authorization',
        framework: 'fedramp-moderate',
        reason: 'Required baseline for most FedRAMP systems'
      },
      {
        scenario: 'Development/testing environments',
        framework: 'nist-800-53-rev4-low',
        reason: 'Minimal controls for non-production systems'
      },
      {
        scenario: 'Modern systems (if available)',
        framework: 'nist-800-53-rev5-moderate',
        reason: 'Latest security controls and guidance'
      }
    ];

    recommendations.forEach(rec => {
      const framework = this.frameworkResolver.getFramework(rec.framework);
      const available = framework && this.frameworkResolver.isFrameworkAvailable(rec.framework);
      const status = available ? '✅' : '❌';
      
      console.log(`${status} ${rec.scenario}:`);
      console.log(`   Framework: ${rec.framework}`);
      console.log(`   Reason: ${rec.reason}`);
      
      if (!available) {
        console.log(`   ⚠️  Not available - check git submodules`);
      }
      
      console.log('');
    });
  }
}