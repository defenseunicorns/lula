# OSCAL Processor

A feature-complete OSCAL (Open Security Controls Assessment Language) processor for importing catalogs and profiles into the Compliance Manager's YAML format.

## Features

### ✅ Complete OSCAL Support
- **Catalog Processing**: Full support for OSCAL catalogs with all control structures
- **Profile Processing**: Imports profiles with control resolution and modifications
- **Back-matter Resolution**: Processes resources, citations, and references
- **Parameter Handling**: Extracts and processes control parameters
- **Enhancement Support**: Handles sub-controls and control enhancements

### ✅ Advanced Capabilities
- **Remote Resource Resolution**: Downloads and caches remote catalogs
- **Multiple Format Support**: JSON, YAML input (XML planned)
- **Flexible Control Selection**: Supports include/exclude patterns from profiles
- **Profile Modifications**: Applies parameter settings and control alterations
- **Git-Friendly Output**: One YAML file per control, organized by family

## Usage

### CLI Commands

Import an OSCAL catalog:
```bash
npx tsx cli/oscal/cli.ts import-catalog catalog.json output-dir
# or integrated with main CLI:
npx tsx cli.ts import-catalog catalog.json output-dir
```

Import an OSCAL profile:
```bash
npx tsx cli/oscal/cli.ts import-profile profile.json output-dir
# or integrated with main CLI:
npx tsx cli.ts import-profile profile.json output-dir
```

Validate OSCAL documents:
```bash
npx tsx cli/oscal/cli.ts validate document.json
```

Show document info:
```bash
npx tsx cli/oscal/cli.ts info document.json
```

### Options
- `--overwrite`: Overwrite existing files
- `--dry-run`: Show what would be processed without writing files

### Programmatic API

```typescript
import { OSCALProcessor, OSCALResolver } from './cli/oscal/index.js';

const processor = new OSCALProcessor();
const resolver = new OSCALResolver();

// Process catalog
await processor.processCatalog('catalog.json', 'output/', { overwrite: true });

// Process profile
const catalogResolver = async (href: string) => {
  return await resolver.resolveCatalogReference(href, baseDir);
};
await processor.processProfile('profile.json', 'output/', catalogResolver);
```

## Output Structure

The processor creates a git-friendly directory structure:

```
output-dir/
├── control-set.yaml          # Catalog/profile metadata
├── back-matter.yaml          # Resources and citations
└── controls/                 # Controls organized by family
    ├── AC/
    │   ├── ac-1.yaml        # Individual control files
    │   └── ac-2.yaml
    ├── AU/
    │   ├── au-1.yaml
    │   └── au-2.yaml
    └── ...
```

### Control File Format

Each control is stored as a YAML file with this structure:

```yaml
id: ac-1
title: Access Control Policy and Procedures
class: SP800-53
family: ac
sort_id: AC-0001
statement: "The organization develops, documents..."
guidance: "This control addresses the establishment..."
parameters:
  - id: ac-1_prm_1
    label: "organization-defined personnel or roles"
    values: ["CISO", "Security Team"]
properties:
  priority: P1
  label: AC-1
links:
  - href: "#reference-uuid"
    rel: reference
source_catalog: "NIST SP 800-53 Rev 4"
source_profile: "HIGH Baseline"
```

## Supported OSCAL Structures

### Catalogs
- ✅ Catalog metadata (title, version, UUID, etc.)
- ✅ Groups and control families
- ✅ Controls with statements, guidance, objectives
- ✅ Control parameters and constraints
- ✅ Sub-controls and enhancements
- ✅ Back-matter resources and citations
- ✅ Links and references

### Profiles
- ✅ Profile metadata
- ✅ Import specifications (include/exclude controls)
- ✅ Control modifications (parameter settings, alterations)
- ✅ Back-matter resolution
- ✅ Remote catalog resolution
- ⏳ Merge strategies (basic support)

### Back-matter
- ✅ Resource definitions
- ✅ Citations and references
- ✅ Remote link resolution
- ✅ Multiple format support (JSON/YAML/XML links)
- ⏳ Embedded base64 content

## Examples

### Processing NIST 800-53 Catalog

```bash
# Download and process NIST catalog
curl -o nist-catalog.json "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_catalog.json"
npx tsx cli.ts import-catalog nist-catalog.json ./nist-controls/
```

### Processing NIST HIGH Baseline Profile

```bash
# Download profile and catalog
curl -o nist-high.json "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_HIGH-baseline_profile.json"
npx tsx cli.ts import-profile nist-high.json ./high-baseline/
```

## Architecture

### Core Classes

- **OSCALProcessor**: Main processing engine for catalogs and profiles
- **OSCALResolver**: Handles remote resource resolution and caching
- **Types**: Comprehensive TypeScript definitions for OSCAL structures

### Key Features

1. **Robust Type System**: Full TypeScript support with detailed OSCAL types
2. **Flexible Resolution**: Handles local files, remote URLs, and back-matter references
3. **Caching**: Intelligent caching of resolved catalogs and resources
4. **Error Handling**: Comprehensive error reporting and validation
5. **Performance**: Efficient processing of large catalogs (256+ controls)

## Testing

Run the test suite:
```bash
npm test cli/oscal/processor.test.ts
```

## Roadmap

- [ ] XML format support
- [ ] Advanced merge strategies
- [ ] OSCAL validation against schemas  
- [ ] Export capabilities (round-trip)
- [ ] Performance optimizations for large documents
- [ ] Interactive profile builder