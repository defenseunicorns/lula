// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * CCI (Control Correlation Identifier) Processor
 * 
 * Downloads, extracts, and processes DISA CCI data from the official source.
 * Builds mappings between CCIs and NIST controls.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as yauzl from 'yauzl';
import { parseStringPromise } from 'xml2js';
import { CCIControl, AtomicControl } from '../types/atomicControl.js';

const CCI_ZIP_URL = 'https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/U_CCI_List.zip';
const CCI_XML_FILENAME = 'U_CCI_List.xml';

export interface CCIItem {
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

export interface CCIDatabase {
  version: string;
  last_updated: string;
  items: Map<string, CCIItem>;
  nist_mappings: Map<string, string[]>; // NIST control ID -> CCI IDs
}

export class CCIProcessor {
  private cacheDir: string;
  private database: CCIDatabase | null = null;

  constructor(cacheDir: string = './.cya/cci_cache') {
    this.cacheDir = cacheDir;
  }

  /**
   * Download and process the latest CCI data
   */
  async loadCCIDatabase(forceRefresh: boolean = false): Promise<CCIDatabase> {
    if (this.database && !forceRefresh) {
      return this.database;
    }

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const zipPath = path.join(this.cacheDir, 'U_CCI_List.zip');
    const xmlPath = path.join(this.cacheDir, CCI_XML_FILENAME);

    // Download if not cached or force refresh
    if (!fs.existsSync(zipPath) || forceRefresh) {
      console.log('Downloading CCI data from DISA...');
      await this.downloadCCIZip(zipPath);
    }

    // Extract if XML not present or force refresh
    if (!fs.existsSync(xmlPath) || forceRefresh) {
      console.log('Extracting CCI XML data...');
      await this.extractCCIXML(zipPath, xmlPath);
    }

    // Parse XML data
    console.log('Processing CCI data...');
    this.database = await this.parseCCIXML(xmlPath);
    
    console.log(`Loaded ${this.database.items.size} CCIs with mappings to ${this.database.nist_mappings.size} NIST controls`);
    return this.database;
  }

  /**
   * Get CCIs mapped to a specific NIST control
   */
  getCCIsForNISTControl(nistControlId: string): CCIItem[] {
    if (!this.database) {
      throw new Error('CCI database not loaded. Call loadCCIDatabase() first.');
    }

    const cciIds = this.database.nist_mappings.get(nistControlId.toUpperCase()) || [];
    return cciIds.map(id => this.database!.items.get(id)).filter(item => item) as CCIItem[];
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
      references: cci.references,
      sort_id: cci.id.toLowerCase(),
      properties: {
        cci_id: cci.id,
        original_definition: cci.definition
      }
    };

    return atomicControl;
  }

  /**
   * Download CCI ZIP file from DISA
   */
  private async downloadCCIZip(outputPath: string): Promise<void> {
    try {
      const response = await fetch(CCI_ZIP_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const readable = Readable.fromWeb(response.body as any);
      const writable = createWriteStream(outputPath);
      
      await pipeline(readable, writable);
    } catch (error) {
      throw new Error(`Failed to download CCI data: ${error}`);
    }
  }

  /**
   * Extract CCI XML from ZIP file
   */
  private async extractCCIXML(zipPath: string, xmlPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(new Error(`Failed to open ZIP file: ${err.message}`));
          return;
        }

        zipfile!.readEntry();
        
        zipfile!.on('entry', (entry) => {
          if (entry.fileName === CCI_XML_FILENAME) {
            zipfile!.openReadStream(entry, (err, readStream) => {
              if (err) {
                reject(new Error(`Failed to read XML from ZIP: ${err.message}`));
                return;
              }

              const writeStream = createWriteStream(xmlPath);
              readStream!.pipe(writeStream);
              
              writeStream.on('close', () => {
                zipfile!.close();
                resolve();
              });
              
              writeStream.on('error', (error) => {
                zipfile!.close();
                reject(new Error(`Failed to write XML file: ${error.message}`));
              });
            });
          } else {
            zipfile!.readEntry();
          }
        });

        zipfile!.on('end', () => {
          reject(new Error(`${CCI_XML_FILENAME} not found in ZIP file`));
        });
      });
    });
  }

  /**
   * Parse CCI XML data
   */
  private async parseCCIXML(xmlPath: string): Promise<CCIDatabase> {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    const result = await parseStringPromise(xmlContent);

    const items = new Map<string, CCIItem>();
    const nistMappings = new Map<string, string[]>();

    const cciList = result.cci_list;
    const version = cciList.$.version || 'unknown';
    const lastUpdated = new Date().toISOString();

    for (const cciItem of cciList.cci_items[0].cci_item || []) {
      const item: CCIItem = {
        id: cciItem.$.id,
        status: cciItem.status[0],
        publish_date: cciItem.publishdate[0],
        contributor: cciItem.contributor[0],
        definition: cciItem.definition[0].trim(),
        type: cciItem.type[0] as 'policy' | 'technical' | 'procedural',
        references: []
      };

      // Process references
      if (cciItem.references && cciItem.references[0].reference) {
        for (const ref of cciItem.references[0].reference) {
          item.references.push({
            creator: ref.$.creator,
            title: ref.$.title,
            version: ref.$.version || '',
            location: ref.$.location || '',
            index: ref.$.index || ''
          });

          // Build NIST mappings
          if (ref.$.creator === 'NIST' && ref.$.index) {
            const match = ref.$.index.match(/^([A-Z]{2,3}-\d+)/);
            if (match) {
              const nistId = match[1];
              if (!nistMappings.has(nistId)) {
                nistMappings.set(nistId, []);
              }
              nistMappings.get(nistId)!.push(item.id);
            }
          }
        }
      }

      items.set(item.id, item);
    }

    return {
      version,
      last_updated: lastUpdated,
      items,
      nist_mappings: nistMappings
    };
  }

  /**
   * Get database statistics
   */
  getStatistics(): { totalCCIs: number; nistMappings: number; version: string } | null {
    if (!this.database) {
      return null;
    }

    return {
      totalCCIs: this.database.items.size,
      nistMappings: this.database.nist_mappings.size,
      version: this.database.version
    };
  }
}