// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Bundled CCI Processor
 * 
 * Uses pre-downloaded and processed CCI data for reliable offline operation.
 * This replaces the runtime download approach with bundled data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CCIControl, AtomicControl } from '../types/atomicControl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CCIItem {
  id: string;
  status: string;
  publish_date: string;
  contributor: string;
  definition: string;
  type: 'policy' | 'technical' | 'procedural';
  references: Array<{
    creator: string;
    title: string;
    version: string;
    location: string;
    index: string;
  }>;
}

interface CCIDatabase {
  version: string;
  last_updated: string;
  download_date: string;
  total_ccis: number;
  nist_mappings_count: number;
  items: CCIItem[];
  nist_mappings: Record<string, string[]>;
}

export class BundledCCIProcessor {
  private database: CCIDatabase | null = null;
  private cciDataPath: string;

  constructor() {
    this.cciDataPath = path.join(__dirname, '../frameworks/cci-data/cci-database.json');
  }

  /**
   * Load CCI database from bundled data
   */
  async loadCCIDatabase(): Promise<CCIDatabase> {
    if (this.database) {
      return this.database;
    }

    if (!fs.existsSync(this.cciDataPath)) {
      throw new Error(
        `CCI database not found at ${this.cciDataPath}. ` +
        'Run "npm run fetch-cci-data" to download and process CCI data.'
      );
    }

    try {
      const data = fs.readFileSync(this.cciDataPath, 'utf8');
      this.database = JSON.parse(data);
      
      console.log(`✅ Loaded CCI database: ${this.database!.total_ccis} CCIs, ${this.database!.nist_mappings_count} NIST mappings`);
      return this.database!;
    } catch (error) {
      throw new Error(`Failed to load CCI database: ${error}`);
    }
  }

  /**
   * Get CCIs mapped to a specific NIST control
   */
  getCCIsForNISTControl(nistControlId: string): CCIItem[] {
    if (!this.database) {
      throw new Error('CCI database not loaded. Call loadCCIDatabase() first.');
    }

    const cciIds = this.database.nist_mappings[nistControlId.toUpperCase()] || [];
    const itemsMap = new Map(this.database.items.map(item => [item.id, item]));
    
    return cciIds.map(id => itemsMap.get(id)).filter(item => item) as CCIItem[];
  }

  /**
   * Get CCIs mapped to a specific NIST control with revision filtering
   */
  getCCIsForNISTControlWithRevision(nistControlId: string, revisionFilter?: '4' | '5'): CCIItem[] {
    const ccis = this.getCCIsForNISTControl(nistControlId);
    
    if (!revisionFilter) {
      return ccis;
    }
    
    return ccis.filter(cci => {
      // Check if this CCI has any NIST SP 800-53 reference with the specified revision
      return cci.references.some(ref => 
        ref.creator === 'NIST' && 
        (ref.title.includes('SP 800-53') || ref.title.includes('Special Publication 800-53')) &&
        ref.version === revisionFilter
      );
    });
  }

  /**
   * Convert CCI item to AtomicControl
   */
  convertCCIToAtomicControl(cci: CCIItem): CCIControl {
    // Extract NIST control references
    const nistRefs = cci.references.filter(ref => 
      ref.creator === 'NIST' && (
        ref.title.includes('SP 800-53') || 
        ref.title.includes('Special Publication 800-53')
      )
    );

    // Determine parent control from NIST references
    let parentControl: string | undefined;
    if (nistRefs.length > 0) {
      // Extract control ID from index (e.g., "AC-1 a 1" -> "AC-1")
      const match = nistRefs[0].index.match(/^([A-Z]{2,3}-\d+)/);
      parentControl = match ? match[1] : undefined;
    }

    // Determine family from parent control
    const family = parentControl ? parentControl.split('-')[0].toLowerCase() : undefined;

    const atomicControl: CCIControl = {
      id: cci.id,
      type: 'cci',
      title: cci.definition.substring(0, 100) + (cci.definition.length > 100 ? '...' : ''),
      definition: cci.definition,
      framework: 'nist-800-53',
      parent_control: parentControl,
      family: family,
      implementation_status: 'not_implemented',
      status: cci.status as 'draft' | 'final',
      publish_date: cci.publish_date,
      contributor: cci.contributor,
      cci_type: cci.type,
      sort_id: cci.id.toLowerCase(),
      properties: {
        cci_id: cci.id,
        original_definition: cci.definition
      }
    };

    return atomicControl;
  }

  /**
   * Convert CCI item to enhanced clean format
   * This generates a cleaner, implementation-focused format like the backup files
   */
  convertCCIToEnhancedControl(cci: CCIItem, oscalData?: any): any {
    // Extract NIST control references
    const nistRefs = cci.references.filter(ref => 
      ref.creator === 'NIST' && (
        ref.title.includes('SP 800-53') || 
        ref.title.includes('Special Publication 800-53')
      )
    );

    // Determine parent control from NIST references
    let parentControl: string | undefined;
    if (nistRefs.length > 0) {
      // Extract control ID from index (e.g., "AC-1 a 1" -> "AC-1")
      const match = nistRefs[0].index.match(/^([A-Z]{2,3}-\d+)/);
      parentControl = match ? match[1] : undefined;
    }

    // Determine family from parent control
    const family = parentControl ? parentControl.split('-')[0].toUpperCase() : 'UNKNOWN';

    // Generate control ID with CCI suffix (e.g., "AC-1.1")
    let controlId: string;
    if (parentControl) {
      // Extract the CCI number and use as suffix (e.g., CCI-000001 -> .1)
      const cciMatch = cci.id.match(/CCI-(\d+)/);
      const cciNumber = cciMatch ? parseInt(cciMatch[1], 10) : 1;
      const suffix = cciNumber.toString();
      controlId = `${parentControl}.${suffix}`;
    } else {
      controlId = cci.id; // Fallback to CCI ID if no parent control
    }

    // Start building the enhanced control with all compliance tracking fields
    const enhancedControl: any = {
      _metadata: {
        controlId: controlId,
        family: family
      },
      
      // Core identification fields
      'control-acronym': parentControl || 'Unknown',
      id: controlId,
      cci: cci.id.replace('CCI-', ''),
      'cci-definition': cci.definition,
      
      // Implementation tracking fields
      'control-implementation-status': 'Not Implemented',
      'security-control-designation': 'System',
      'control-implementation-narrative': '',
      
      // Assessment/Authorization Package fields
      'ap-acronym': '',
      
      // Implementation and assessment guidance (will be populated from OSCAL)
      'implementation-guidance': '',
      'assessment-procedures': [],
      
      // Inheritance tracking
      'inherited': false,
      'remote-inheritance-instance': '',
      
      // Testing and compliance tracking
      'compliance-status': 'Not Assessed',
      'date-tested': '',
      'tested-by': '',
      'test-results': ''
    };

    return enhancedControl;
  }

  /**
   * Get database statistics
   */
  getStatistics(): { totalCCIs: number; nistMappings: number; version: string; downloadDate: string } | null {
    if (!this.database) {
      return null;
    }

    return {
      totalCCIs: this.database.total_ccis,
      nistMappings: this.database.nist_mappings_count,
      version: this.database.version,
      downloadDate: this.database.download_date
    };
  }

  /**
   * Check if CCI data is available
   */
  isAvailable(): boolean {
    return fs.existsSync(this.cciDataPath);
  }

  /**
   * Get CCI data metadata
   */
  getMetadata(): any {
    const metadataPath = path.join(__dirname, '../frameworks/cci-data/metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
}