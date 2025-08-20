# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Compliance Manager** - a Git-friendly compliance control management system built with SvelteKit 5. The application manages security compliance controls (like NIST 800-53) with individual YAML files per control, enabling proper version control and collaboration on compliance documentation. It is designed to be a generic way to manage 
controls of any sort, split the work of defining them, mapping them and also associating to actual source code & docs 
for tracking changes over time. Everything is persisted by git and this is intended to be run as an `npx app` command
against a local git repo.

## Key Development Commands

### Development Server (typically already running out-of-band)
- `npm run dev` - Start frontend development server on port 5173
- `npm run dev:api` - Start backend API server on port 3000 (serves from examples/nist-800-53-rev4)
- `npm run dev:full` - Run both frontend and backend concurrently

### Building and Testing
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run unit tests (vitest)
- `npm run test:unit` - Run unit tests in watch mode

### Code Quality
- `npm run lint` - Check code formatting and linting (prettier + eslint)
- `npm run format` - Format code with prettier
- `npm run check` - Type check with svelte-check

### CLI Tool
- `tsx cli.ts serve --dir <path> --port <port>` - Start server for specific control set
- `tsx cli.ts import --file <oscal-file> --dir <output-dir>` - Import OSCAL catalog or profile (auto-detected)
- `tsx cli.ts import-catalog <catalog-file> <output-dir>` - Import OSCAL catalog with options
- `tsx cli.ts import-profile <profile-file> <output-dir>` - Import OSCAL profile with options  
- `tsx cli.ts migrate --dir <path>` - Migrate from monolithic YAML to individual files
- `tsx cli.ts status --dir <path>` - Check migration status

## Architecture

### Frontend (SvelteKit 5 with Runes)
- **Svelte 5** with new runes-based state management (`$state`, `$effect`, `$derived`)
- **TailwindCSS 4** for styling
- **Component structure**: Organized by feature (controls/, forms/, timeline/, ui/)
- **Stores**: Uses Svelte runes instead of traditional stores
- **API layer**: Centralized in `src/lib/api.ts`

### Backend (Express + Node.js)
- **CLI-first approach**: Express server embedded in CLI tool (`cli.ts`)
- **File-based storage**: Individual YAML files per control in `controls/<family>/` directories
- **Git integration**: Built-in git history tracking for all files
- **In-memory caching**: Controls and mappings cached for performance

### Data Model
- **Controls**: Individual security controls stored as YAML files
- **Mappings**: Source code mappings to controls (stored in family-based YAML files)
- **Control Sets**: NIST 800-53 Rev 4 example included in `examples/`

### File Structure
```
examples/nist-800-53-rev4/
├── control-set.yaml          # Control set metadata
├── controls/                 # Individual control files
│   ├── AC/                   # Access Control family
│   ├── AU/                   # Audit family
│   └── ...
└── mappings/                 # Source code mappings
    ├── AC/
    └── ...
```

## Key Libraries and Frameworks

- **SvelteKit 5**: Meta-framework with runes
- **Express**: Backend API server
- **YAML**: Control and mapping file format
- **isomorphic-git**: Git operations in Node.js
- **Commander**: CLI interface
- **TailwindCSS**: Utility-first CSS framework
- **Vitest**: Testing framework
- **TypeScript**: Type safety throughout

## Development Patterns

### State Management
- Use Svelte 5 runes (`$state`, `$effect`, `$derived`) instead of traditional stores
- Keep state local to components when possible
- Use the API client (`src/lib/api.ts`) for server communication

### File Operations
- All file operations go through `FileStore` class (`src/lib/fileStore.ts`)
- Git operations handled by `GitHistoryUtil` (`src/lib/gitHistory.ts`)
- Migration utilities in `src/lib/migration.ts`

### Component Architecture
- Prefer composition over inheritance
- Use TypeScript interfaces defined in `src/lib/types.ts`
- Components in `src/components/` organized by feature area

### OSCAL Processing System
- Complete OSCAL catalog and profile import via `cli/oscal/` system
- Auto-detection of OSCAL catalogs vs profiles
- Back-matter resource resolution and caching  
- Enhancement flattening (individual files per control and sub-control)
- Profile modifications (priority assignment, control alterations)
- Git-friendly YAML output with one control per file (922 controls from NIST catalog)
- Configurable options: `--no-links` (remove references), `--flatten-refs` (resolve back-matter)

## Testing
- Unit tests with Vitest
- Browser testing available via `@vitest/browser`
- Test files co-located with source (`.test.ts` suffix)

## Git-Friendly Design
- Individual YAML files per control enable meaningful diffs
- Git history integration shows file-level changes over time
- Migration tools help transition from monolithic files
