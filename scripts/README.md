# Scripts Directory

## fetch-cci-data.ts

Framework data fetching script that downloads and processes:

- DISA CCI (Control Correlation Identifier) data
- NIST OSCAL catalogs and profiles

**Usage:**

- As build step: `npm run update-frameworks` (recommended)
- Direct execution: `tsx scripts/fetch-cci-data.ts`

**Output Directories:**

- `cli/frameworks/cci-data/` - CCI database and metadata (processed JSON + XML)
- `cli/frameworks/nist-oscal-data/` - NIST OSCAL files

**Note:** Temporary ZIP files are automatically cleaned up and excluded from git.

**Build Integration:**
The framework data is fetched during the prebuild step (`npm run prebuild`) and committed to the repository. This ensures the CLI package includes all necessary framework data without requiring runtime downloads.
