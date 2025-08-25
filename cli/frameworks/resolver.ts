// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Framework Resolver
 * 
 * Manages bundled OSCAL frameworks and provides easy access to common
 * compliance baselines without requiring users to understand OSCAL internals.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface FrameworkInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  baseline?: string;
  file_path: string;
  recommended_cci: boolean;
  use_case: string;
}

export class FrameworkResolver {
  private frameworks: Map<string, FrameworkInfo> = new Map();
  private oscalContentPath: string;

  constructor() {
    this.oscalContentPath = path.join(__dirname, 'nist-oscal-data');
    this.loadFrameworkRegistry();
  }

  /**
   * Get all available frameworks
   */
  getFrameworks(): FrameworkInfo[] {
    return Array.from(this.frameworks.values());
  }

  /**
   * Get framework by ID
   */
  getFramework(id: string): FrameworkInfo | undefined {
    return this.frameworks.get(id);
  }

  /**
   * Get framework file path
   */
  getFrameworkPath(id: string): string | undefined {
    const framework = this.frameworks.get(id);
    return framework ? path.resolve(framework.file_path) : undefined;
  }

  /**
   * Check if framework exists and is accessible
   */
  isFrameworkAvailable(id: string): boolean {
    const frameworkPath = this.getFrameworkPath(id);
    return frameworkPath ? fs.existsSync(frameworkPath) : false;
  }

  /**
   * Load framework registry with bundled NIST OSCAL content
   */
  private loadFrameworkRegistry(): void {
    // NIST 800-53 Revision 4 Baselines (using minified resolved catalogs)
    this.frameworks.set('nist-800-53-rev4-low', {
      id: 'nist-800-53-rev4-low',
      name: 'NIST SP 800-53 Revision 4',
      description: 'Low impact baseline for federal information systems',
      version: 'Rev 4',
      baseline: 'LOW',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'Low-risk federal systems, development environments'
    });

    this.frameworks.set('nist-800-53-rev4-moderate', {
      id: 'nist-800-53-rev4-moderate',
      name: 'NIST SP 800-53 Revision 4',
      description: 'Moderate impact baseline for federal information systems',
      version: 'Rev 4',
      baseline: 'MODERATE',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'Most federal systems, moderate-risk commercial systems'
    });

    this.frameworks.set('nist-800-53-rev4-high', {
      id: 'nist-800-53-rev4-high',
      name: 'NIST SP 800-53 Revision 4',
      description: 'High impact baseline for federal information systems',
      version: 'Rev 4',
      baseline: 'HIGH',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'High-risk federal systems, defense, intelligence'
    });

    // NIST 800-53 Revision 5 Baselines (using minified resolved catalogs)
    this.frameworks.set('nist-800-53-rev5-low', {
      id: 'nist-800-53-rev5-low',
      name: 'NIST SP 800-53 Revision 5',
      description: 'Low impact baseline (latest revision)',
      version: 'Rev 5',
      baseline: 'LOW',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'Modern systems requiring latest security controls'
    });

    this.frameworks.set('nist-800-53-rev5-moderate', {
      id: 'nist-800-53-rev5-moderate',
      name: 'NIST SP 800-53 Revision 5',
      description: 'Moderate impact baseline (latest revision)',
      version: 'Rev 5',
      baseline: 'MODERATE',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'Modern systems requiring latest security controls'
    });

    this.frameworks.set('nist-800-53-rev5-high', {
      id: 'nist-800-53-rev5-high',
      name: 'NIST SP 800-53 Revision 5',
      description: 'High impact baseline (latest revision)',
      version: 'Rev 5',
      baseline: 'HIGH',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'Modern high-risk systems requiring latest security controls'
    });

    // FedRAMP Baselines (these are typically based on NIST baselines)
    this.frameworks.set('fedramp-low', {
      id: 'fedramp-low',
      name: 'FedRAMP Low Impact',
      description: 'FedRAMP authorization baseline for low-impact cloud services',
      version: 'Rev 4',
      baseline: 'LOW',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog-min.json'), // FedRAMP uses NIST baselines
      recommended_cci: true,
      use_case: 'FedRAMP cloud services, SaaS applications'
    });

    this.frameworks.set('fedramp-moderate', {
      id: 'fedramp-moderate',
      name: 'FedRAMP Moderate Impact',
      description: 'FedRAMP authorization baseline for moderate-impact cloud services',
      version: 'Rev 4',
      baseline: 'MODERATE',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'Most FedRAMP cloud services'
    });

    this.frameworks.set('fedramp-high', {
      id: 'fedramp-high',
      name: 'FedRAMP High Impact',
      description: 'FedRAMP authorization baseline for high-impact cloud services',
      version: 'Rev 4',
      baseline: 'HIGH',
      file_path: path.join(this.oscalContentPath, 'NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog-min.json'),
      recommended_cci: true,
      use_case: 'High-impact FedRAMP cloud services, DoD systems'
    });
  }

  /**
   * Get frameworks grouped by category
   */
  getFrameworksByCategory(): Record<string, FrameworkInfo[]> {
    const frameworks = this.getFrameworks();
    const categories: Record<string, FrameworkInfo[]> = {
      'NIST 800-53 Rev 4': [],
      'NIST 800-53 Rev 5': [],
      'FedRAMP': []
    };

    frameworks.forEach(framework => {
      if (framework.id.includes('rev4')) {
        categories['NIST 800-53 Rev 4'].push(framework);
      } else if (framework.id.includes('rev5')) {
        categories['NIST 800-53 Rev 5'].push(framework);
      } else if (framework.id.includes('fedramp')) {
        categories['FedRAMP'].push(framework);
      }
    });

    return categories;
  }

  /**
   * Get recommended framework based on use case
   */
  getRecommendedFramework(useCase?: 'development' | 'production' | 'federal' | 'cloud'): FrameworkInfo {
    switch (useCase) {
      case 'development':
        return this.frameworks.get('nist-800-53-rev4-low')!;
      case 'cloud':
        return this.frameworks.get('fedramp-moderate')!;
      case 'federal':
        return this.frameworks.get('nist-800-53-rev4-moderate')!;
      case 'production':
      default:
        return this.frameworks.get('nist-800-53-rev4-moderate')!;
    }
  }
}