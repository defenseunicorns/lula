// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { OSCALCatalog, OSCALResource } from './types.js';

/**
 * Resolves OSCAL document references and handles remote/local resource loading
 */
export class OSCALResolver {
  private catalogCache: Map<string, OSCALCatalog> = new Map();
  private resourceCache: Map<string, any> = new Map();

  /**
   * Resolve a catalog reference from a profile import
   */
  async resolveCatalogReference(
    href: string,
    baseDir: string,
    backMatterResources?: Map<string, OSCALResource>
  ): Promise<OSCALCatalog> {
    // Check cache first
    if (this.catalogCache.has(href)) {
      return this.catalogCache.get(href)!;
    }

    let resolvedPath: string;

    // Handle different href types
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Remote URL - download and cache
      resolvedPath = await this.downloadResource(href, baseDir);
    } else if (href.startsWith('#')) {
      // Back-matter reference
      const resourceId = href.substring(1);
      if (backMatterResources?.has(resourceId)) {
        const resource = backMatterResources.get(resourceId)!;
        resolvedPath = await this.resolveResourceLinks(resource, baseDir);
      } else {
        throw new Error(`Back-matter resource not found: ${resourceId}`);
      }
    } else {
      // Relative path
      resolvedPath = path.resolve(baseDir, href);
    }

    // Load and parse catalog
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Catalog file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    let catalog: OSCALCatalog;

    if (resolvedPath.endsWith('.json')) {
      catalog = JSON.parse(content);
    } else if (resolvedPath.endsWith('.yaml') || resolvedPath.endsWith('.yml')) {
      const { parse } = await import('yaml');
      catalog = parse(content) as OSCALCatalog;
    } else if (resolvedPath.endsWith('.xml')) {
      // For XML, we'd need an XML parser - for now, throw error
      throw new Error('XML catalog parsing not yet implemented');
    } else {
      throw new Error(`Unsupported catalog format: ${resolvedPath}`);
    }

    // Cache and return
    this.catalogCache.set(href, catalog);
    return catalog;
  }

  /**
   * Resolve resource links from back-matter to actual file paths
   */
  private async resolveResourceLinks(resource: OSCALResource, baseDir: string): Promise<string> {
    if (!resource.rlinks || resource.rlinks.length === 0) {
      throw new Error(`Resource ${resource.uuid} has no rlinks`);
    }

    // Prefer JSON, then YAML, then XML
    const preferredFormats = [
      'application/oscal.catalog+json',
      'application/json',
      'application/oscal.catalog+yaml', 
      'application/yaml',
      'application/oscal.catalog+xml',
      'application/xml'
    ];

    for (const format of preferredFormats) {
      const link = resource.rlinks.find(rlink => rlink['media-type'] === format);
      if (link) {
        if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
          return await this.downloadResource(link.href, baseDir);
        } else {
          return path.resolve(baseDir, link.href);
        }
      }
    }

    // If no preferred format found, use first available link
    const firstLink = resource.rlinks[0];
    if (firstLink.href.startsWith('http://') || firstLink.href.startsWith('https://')) {
      return await this.downloadResource(firstLink.href, baseDir);
    } else {
      return path.resolve(baseDir, firstLink.href);
    }
  }

  /**
   * Download remote resource and cache locally
   */
  private async downloadResource(url: string, cacheDir: string): Promise<string> {
    // Check if already downloaded
    const filename = this.generateCacheFilename(url);
    const cachePath = path.join(cacheDir, '.oscal-cache', filename);

    if (fs.existsSync(cachePath)) {
      return cachePath;
    }

    // Create cache directory
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // Download file
    console.log(`Downloading ${url}...`);
    const content = await this.downloadFile(url);
    fs.writeFileSync(cachePath, content);

    return cachePath;
  }

  /**
   * Download file from URL
   */
  private downloadFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;
      
      client.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirects
          if (response.headers.location) {
            this.downloadFile(response.headers.location).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  /**
   * Generate cache filename from URL
   */
  private generateCacheFilename(url: string): string {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const filename = pathParts[pathParts.length - 1] || 'resource';
    
    // Include hostname to avoid conflicts
    const hostname = urlObj.hostname.replace(/\./g, '_');
    return `${hostname}_${filename}`;
  }

  /**
   * Clear the resolver cache
   */
  clearCache(): void {
    this.catalogCache.clear();
    this.resourceCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { catalogs: number; resources: number } {
    return {
      catalogs: this.catalogCache.size,
      resources: this.resourceCache.size
    };
  }
}
