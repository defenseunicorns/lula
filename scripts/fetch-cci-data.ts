#!/usr/bin/env tsx
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Framework Data Fetcher Script
 * 
 * Downloads and processes both DISA CCI data and NIST OSCAL data for bundling with the CLI.
 * This provides reliable, version-controlled framework data without runtime downloads.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as yauzl from 'yauzl';
import { parseStringPromise } from 'xml2js';

const CCI_ZIP_URL = 'https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/U_CCI_List.zip';
const CCI_XML_FILENAME = 'U_CCI_List.xml';

// NIST OSCAL Configuration
const NIST_OSCAL_COMMIT = 'main'; // TODO: Pin to specific commit hash
const BASE_URL = `https://github.com/usnistgov/oscal-content/raw/refs/heads/${NIST_OSCAL_COMMIT}/nist.gov/SP800-53`;

// NIST OSCAL files to download
const NIST_FILES = [
  // NIST 800-53 Rev 4 Baselines
  {
    id: 'nist-800-53-rev4-low',
    url: `${BASE_URL}/rev4/json/NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog-min.json`,
    filename: 'NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog-min.json',
    version: 'Rev 4',
    baseline: 'LOW'
  },
  {
    id: 'nist-800-53-rev4-moderate',
    url: `${BASE_URL}/rev4/json/NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog-min.json`,
    filename: 'NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog-min.json',
    version: 'Rev 4',
    baseline: 'MODERATE'
  },
  {
    id: 'nist-800-53-rev4-high',
    url: `${BASE_URL}/rev4/json/NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog-min.json`,
    filename: 'NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog-min.json',
    version: 'Rev 4',
    baseline: 'HIGH'
  },
  // NIST 800-53 Rev 5 Baselines (for future use)
  {
    id: 'nist-800-53-rev5-low',
    url: `${BASE_URL}/rev5/json/NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json`,
    filename: 'NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json',
    version: 'Rev 5',
    baseline: 'LOW'
  },
  {
    id: 'nist-800-53-rev5-moderate',
    url: `${BASE_URL}/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json`,
    filename: 'NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json',
    version: 'Rev 5',
    baseline: 'MODERATE'
  },
  {
    id: 'nist-800-53-rev5-high',
    url: `${BASE_URL}/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json`,
    filename: 'NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json',
    version: 'Rev 5',
    baseline: 'HIGH'
  }
];

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
  nist_mappings: Record<string, string[]>; // NIST control ID -> CCI IDs
}

async function main() {
  const cciOutputDir = path.join(process.cwd(), 'cli/frameworks/cci-data');
  const nistOutputDir = path.join(process.cwd(), 'cli/frameworks/nist-oscal-data');
  
  console.log('🔽 Fetching framework data...');
  
  let overallSuccess = true;
  
  try {
    // Fetch CCI data
    console.log('\n📋 === CCI Data ===');
    await fetchCCIData(cciOutputDir);
    
    // Fetch NIST OSCAL data
    console.log('\n🏛️ === NIST OSCAL Data ===');
    await fetchNISTOSCALData(nistOutputDir);
    
    console.log('\n🎉 All framework data fetched successfully!');
    console.log(`📁 CCI files saved to: ${cciOutputDir}`);
    console.log(`📁 NIST OSCAL files saved to: ${nistOutputDir}`);
    
  } catch (error) {
    console.error('❌ Error fetching framework data:', error);
    overallSuccess = false;
  }
  
  if (!overallSuccess) {
    process.exit(1);
  }
}

/**
 * Fetch and process CCI data
 */
async function fetchCCIData(outputDir: string) {
  console.log('🔽 Fetching CCI data from DISA...');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const zipPath = path.join(outputDir, 'U_CCI_List.zip');
  const xmlPath = path.join(outputDir, CCI_XML_FILENAME);
  const jsonPath = path.join(outputDir, 'cci-database.json');
  
  // Download ZIP file
  console.log('📥 Downloading CCI ZIP file...');
  await downloadCCIZip(zipPath);
  console.log('✅ Download complete');
  
  // Extract XML from ZIP
  console.log('📦 Extracting XML from ZIP...');
  await extractCCIXML(zipPath, xmlPath);
  console.log('✅ Extraction complete');
  
  // Parse XML and build database
  console.log('🔄 Processing CCI data...');
  const database = await parseCCIXML(xmlPath);
  console.log('✅ Processing complete');
  
  // Save as JSON for easy consumption
  console.log('💾 Saving processed data...');
  fs.writeFileSync(jsonPath, JSON.stringify(database, null, 2));
  console.log('✅ Data saved');
  
  // Print statistics
  console.log('\n📊 CCI Data Statistics:');
  console.log(`  Version: ${database.version}`);
  console.log(`  Total CCIs: ${database.total_ccis}`);
  console.log(`  NIST Mappings: ${database.nist_mappings_count} controls`);
  console.log(`  Download Date: ${database.download_date}`);
  console.log(`  File Size: ${(fs.statSync(jsonPath).size / 1024 / 1024).toFixed(1)} MB`);
  
  // Create metadata file
  const metadataPath = path.join(outputDir, 'metadata.json');
  const metadata = {
    version: database.version,
    last_updated: database.last_updated,
    download_date: database.download_date,
    total_ccis: database.total_ccis,
    nist_mappings_count: database.nist_mappings_count,
    source_url: CCI_ZIP_URL,
    files: {
      database: 'cci-database.json',
      raw_xml: CCI_XML_FILENAME,
      raw_zip: 'U_CCI_List.zip'
    }
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log('✅ CCI metadata saved');
}

/**
 * Fetch NIST OSCAL data
 */
async function fetchNISTOSCALData(outputDir: string) {
  console.log('🔄 Fetching NIST OSCAL data...');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created directory: ${outputDir}`);
  }

  let successCount = 0;
  let failCount = 0;

  // Download each NIST file
  for (const file of NIST_FILES) {
    console.log(`\n📥 Downloading ${file.filename}...`);
    
    try {
      const response = await fetch(file.url);
      
      if (!response.ok) {
        console.error(`❌ HTTP ${response.status} for ${file.filename}`);
        failCount++;
        continue;
      }

      const content = await response.text();
      const filePath = path.join(outputDir, file.filename);
      
      // Write the file
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Validate it's valid JSON
      try {
        JSON.parse(content);
        console.log(`✅ ${file.filename} (${(content.length / 1024).toFixed(1)} KB)`);
        successCount++;
      } catch (parseError) {
        console.error(`❌ Invalid JSON in ${file.filename}: ${parseError.message}`);
        fs.unlinkSync(filePath); // Clean up invalid file
        failCount++;
      }
      
    } catch (error) {
      console.error(`❌ Error downloading ${file.filename}: ${error.message}`);
      failCount++;
    }
  }

  // Create metadata file
  const metadataPath = path.join(outputDir, 'metadata.json');
  const metadata = {
    source: 'NIST OSCAL Content',
    source_url: 'https://github.com/usnistgov/oscal-content',
    commit: NIST_OSCAL_COMMIT,
    download_date: new Date().toISOString(),
    total_files: NIST_FILES.length,
    successful_downloads: successCount,
    failed_downloads: failCount,
    files: NIST_FILES.map(f => ({
      id: f.id,
      filename: f.filename,
      version: f.version,
      baseline: f.baseline,
      url: f.url
    }))
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`\n📄 Created NIST OSCAL metadata: ${metadataPath}`);

  // Summary
  console.log(`\n📊 NIST OSCAL Download Summary:`);
  console.log(`   ✅ Successful: ${successCount}/${NIST_FILES.length}`);
  if (failCount > 0) {
    console.log(`   ❌ Failed: ${failCount}/${NIST_FILES.length}`);
  }

  if (failCount > 0) {
    throw new Error(`Failed to download ${failCount} NIST OSCAL files`);
  }
}

/**
 * Download CCI ZIP file from DISA
 */
async function downloadCCIZip(outputPath: string): Promise<void> {
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
async function extractCCIXML(zipPath: string, xmlPath: string): Promise<void> {
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
async function parseCCIXML(xmlPath: string): Promise<CCIDatabase> {
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const result = await parseStringPromise(xmlContent);

  const items: CCIItem[] = [];
  const nistMappings: Record<string, string[]> = {};

  const cciList = result.cci_list;
  const version = cciList.$.version || 'unknown';
  const lastUpdated = new Date().toISOString();
  const downloadDate = new Date().toISOString();

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
            if (!nistMappings[nistId]) {
              nistMappings[nistId] = [];
            }
            nistMappings[nistId].push(item.id);
          }
        }
      }
    }

    items.push(item);
  }

  return {
    version,
    last_updated: lastUpdated,
    download_date: downloadDate,
    total_ccis: items.length,
    nist_mappings_count: Object.keys(nistMappings).length,
    items,
    nist_mappings: nistMappings
  };
}

// Run the script
main();