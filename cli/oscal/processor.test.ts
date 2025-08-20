import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { OSCALProcessor } from './processor.js';
import { OSCALCatalog, OSCALProfile } from './types.js';

// Test data
const testCatalog: OSCALCatalog = {
  catalog: {
    uuid: 'test-catalog-uuid',
    metadata: {
      title: 'Test Catalog',
      'last-modified': '2025-08-20T00:00:00Z',
      version: '1.0.0',
      'oscal-version': '1.1.1',
    },
    groups: [
      {
        id: 'test-family',
        title: 'Test Control Family',
        controls: [
          {
            id: 'test-1',
            title: 'Test Control 1',
            parts: [
              {
                id: 'test-1-statement',
                name: 'statement',
                prose: 'This is a test control statement.'
              },
              {
                id: 'test-1-guidance',
                name: 'guidance',
                prose: 'This is guidance for the test control.'
              }
            ]
          }
        ]
      }
    ],
    'back-matter': {
      resources: [
        {
          uuid: 'test-resource-uuid',
          title: 'Test Resource',
          citation: {
            text: 'Test Citation'
          }
        }
      ]
    }
  }
};

const testProfile: OSCALProfile = {
  profile: {
    uuid: 'test-profile-uuid',
    metadata: {
      title: 'Test Profile',
      'last-modified': '2025-08-20T00:00:00Z',
      version: '1.0.0',
      'oscal-version': '1.1.1',
    },
    imports: [
      {
        href: 'test-catalog.json',
        'include-controls': [
          {
            'with-ids': ['test-1']
          }
        ]
      }
    ]
  }
};

describe('OSCALProcessor', () => {
  let processor: OSCALProcessor;
  let tempDir: string;

  beforeEach(() => {
    processor = new OSCALProcessor();
    tempDir = fs.mkdtempSync(path.join(__dirname, 'test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('processCatalog', () => {
    it('should process a catalog and create YAML files', async () => {
      // Create test catalog file
      const catalogPath = path.join(tempDir, 'test-catalog.json');
      fs.writeFileSync(catalogPath, JSON.stringify(testCatalog, null, 2));

      const outputDir = path.join(tempDir, 'output');
      
      // Process catalog
      await processor.processCatalog(catalogPath, outputDir, { overwrite: true });

      // Verify output structure
      expect(fs.existsSync(path.join(outputDir, 'control-set.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'back-matter.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'controls', 'test-family', 'test-1.yaml'))).toBe(true);

      // Verify control content
      const controlContent = fs.readFileSync(
        path.join(outputDir, 'controls', 'test-family', 'test-1.yaml'), 
        'utf8'
      );
      
      expect(controlContent).toContain('id: test-1');
      expect(controlContent).toContain('title: Test Control 1');
      expect(controlContent).toContain('family: test-family');
      expect(controlContent).toContain('statement: This is a test control statement.');
      expect(controlContent).toContain('guidance: This is guidance for the test control.');
    });

    it('should handle dry run mode', async () => {
      const catalogPath = path.join(tempDir, 'test-catalog.json');
      fs.writeFileSync(catalogPath, JSON.stringify(testCatalog, null, 2));

      const outputDir = path.join(tempDir, 'output');
      
      // Process catalog in dry run mode
      await processor.processCatalog(catalogPath, outputDir, { dryRun: true });

      // Verify no files were created
      expect(fs.existsSync(outputDir)).toBe(false);
    });
  });

  describe('processProfile', () => {
    it('should process a profile with catalog resolver', async () => {
      // Create test files
      const catalogPath = path.join(tempDir, 'test-catalog.json');
      const profilePath = path.join(tempDir, 'test-profile.json');
      
      fs.writeFileSync(catalogPath, JSON.stringify(testCatalog, null, 2));
      fs.writeFileSync(profilePath, JSON.stringify(testProfile, null, 2));

      const outputDir = path.join(tempDir, 'output');

      // Create catalog resolver
      const catalogResolver = async (href: string) => {
        if (href === 'test-catalog.json') {
          return testCatalog;
        }
        throw new Error(`Unknown catalog: ${href}`);
      };

      // Process profile
      await processor.processProfile(profilePath, outputDir, catalogResolver, { overwrite: true });

      // Verify output
      expect(fs.existsSync(path.join(outputDir, 'control-set.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'controls', 'test-family', 'test-1.yaml'))).toBe(true);

      // Verify metadata indicates profile source
      const metadataContent = fs.readFileSync(
        path.join(outputDir, 'control-set.yaml'),
        'utf8'
      );
      expect(metadataContent).toContain('source_type: profile');
    });
  });

  describe('control processing', () => {
    it('should generate correct sort IDs', () => {
      const processor = new OSCALProcessor();
      // Access private method for testing
      const generateSortId = (processor as any).generateSortId.bind(processor);

      expect(generateSortId('AC-1')).toBe('AC-0001');
      expect(generateSortId('AC-10')).toBe('AC-0010');
      expect(generateSortId('AC-2.1')).toBe('AC-0002.1');
      expect(generateSortId('PM-1')).toBe('PM-0001');
    });

    it('should extract properties correctly', () => {
      const processor = new OSCALProcessor();
      const extractProperties = (processor as any).extractProperties.bind(processor);

      const props = [
        { name: 'priority', value: 'P1' },
        { name: 'label', value: 'AC-1' }
      ];

      const result = extractProperties(props);
      expect(result).toEqual({
        priority: 'P1',
        label: 'AC-1'
      });
    });
  });
});