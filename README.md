# Lula - Compliance Manager

A git-friendly compliance control management system that supports multiple compliance frameworks through a generic adapter pattern.

## Features

- **Git-friendly YAML storage** - Individual control files for optimal version control
- **Multi-format support** - Generic adapter system for different compliance frameworks
- **OSCAL import** - Import official NIST OSCAL catalogs to internal format
- **Web interface** - Interactive dashboard for managing controls and mappings
- **CLI tools** - Command-line interface for imports, migrations, and management
- **Version history** - Git integration for tracking control changes over time

## Supported Formats

- **Internal YAML** - Git-friendly storage format (default)
- **OSCAL Import** - Import from official NIST OSCAL catalogs

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Web Interface

Start the web server to manage controls through the browser:

```bash
npx tsx cli.ts serve --dir ./examples/nist-800-53-rev4
```

The interface will be available at `http://localhost:3000`

### CLI Usage

#### Import OSCAL Catalog

Import controls from an official NIST OSCAL catalog:

```bash
# Download OSCAL catalog
curl -o nist-catalog.json "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_catalog.json"

# Import controls (dry run first to preview)
npx tsx cli.ts import --file nist-catalog.json --format oscal-import --dry-run

# Perform actual import
npx tsx cli.ts import --file nist-catalog.json --format oscal-import --dir ./my-controls
```

#### Migration

Migrate from legacy single YAML files to individual control files:

```bash
# Check migration status
npx tsx cli.ts status --dir ./examples/nist-800-53-rev4

# Run migration
npx tsx cli.ts migrate --dir ./examples/nist-800-53-rev4
```

## Project Structure

```
├── src/
│   ├── components/          # Svelte UI components
│   ├── lib/
│   │   ├── adapters/        # Format adapter system
│   │   │   ├── oscal-import.ts    # OSCAL import adapter
│   │   │   ├── nist-native.ts     # Internal YAML adapter
│   │   │   └── types.ts           # Adapter interfaces
│   │   ├── fileStore.ts     # File storage utilities
│   │   ├── gitHistory.ts    # Git integration
│   │   └── types.ts         # Core type definitions
│   └── routes/              # SvelteKit routes
├── cli.ts                   # Command-line interface
└── examples/                # Example control sets
    └── nist-800-53-rev4/   # NIST 800-53 Rev 4 examples
```

## Adapter System

The system uses a generic adapter pattern to support multiple compliance frameworks:

```typescript
// Import with specific adapter
const result = await importWithAdapter(data, 'oscal-import');

// Auto-detect format
const adapter = detectAdapter(data);
const result = await adapter.import(data);
```

### Available Adapters

- `internal-yaml` - Internal YAML storage format
- `oscal-import` - Import from NIST OSCAL catalogs

## Development

### Running Tests

```bash
npm test
```

### Development Server

```bash
npm run dev
```

### Building

```bash
npm run build
```

## File Formats

### Control Files

Individual controls are stored as YAML files with metadata:

```yaml
_metadata:
  controlId: AC-1
  family: AC
id: AC-1
control-acronym: AC-1
control-information: |
  Title: Access Control Policy and Procedures
  
  Statement: The organization develops, documents...
control-implementation-status: Not Implemented
# ... additional fields
```

### Control Set Structure

```
control-set/
├── control-set.yaml         # Control set metadata
├── controls/                # Individual control files
│   ├── AC/                  # Access Control family
│   │   ├── AC-1_SHORT.yaml
│   │   └── AC-2_SHORT.yaml
│   └── AU/                  # Audit family
└── mappings/                # Control mappings
    └── AC/
        └── AC-mappings.yaml
```

## Contributing

1. Follow existing code patterns
2. Add tests for new functionality
3. Update documentation
4. Use TypeScript for type safety
