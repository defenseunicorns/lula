# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Lula 2** - a Git-friendly compliance control management system built with SvelteKit 5. The application manages security compliance controls (like NIST 800-53) with individual YAML files per control, enabling proper version control and collaboration on compliance documentation. It is designed to be a generic way to manage controls of any sort, split the work of defining them, mapping them and also associating to actual source code & docs for tracking changes over time. Everything is persisted by git and this is intended to be run as an `npx` command against a local git repo.

## Key Development Commands

**Note:** This project uses pnpm as the package manager. All commands below use `pnpm`, but `npm` can also be used.

### Development Server

- `pnpm run dev` - Start frontend development server on port 5173
- `pnpm run dev:api` - Start backend API server on port 3000 (serves from current directory)
- `pnpm run dev:full` - Run both frontend and backend concurrently

### Building and Testing

- `pnpm run build` - Build both SvelteKit app and CLI for production
- `pnpm run build:svelte` - Build only the SvelteKit app
- `pnpm run build:cli` - Build only the CLI tool
- `pnpm run preview` - Preview production build
- `pnpm run test` - Run unit tests (vitest)
- `pnpm run test:unit` - Run unit tests in watch mode

### Code Quality

- `pnpm run lint` - Check code formatting and linting (prettier + eslint)
- `pnpm run format` - Format code with prettier
- `pnpm run format:check` - Check code formatting without modifying files
- `pnpm run check` - Type check with svelte-check

### CLI Tool

- `npx lula2` - Run the CLI tool directly (production)
- `npx lula2 --dir <path> --port <port>` - Start server for specific control set
- `npx lula2 crawl` - Analyze pull requests for compliance impact
- `npx lula2 --version` - Show version
- `tsx index.ts` - Run CLI in development mode

## Architecture

### Frontend (SvelteKit 5 with Runes)

- **Svelte 5** with new runes-based state management (`$state`, `$effect`, `$derived`)
- **TailwindCSS 4** for styling
- **Component structure**: Organized by feature (controls/, forms/, timeline/, ui/)
- **Stores**: Uses Svelte runes instead of traditional stores
- **API layer**: Centralized in `src/lib/api.ts`

### Backend (Express + Node.js)

- **CLI-first approach**: Express server embedded in CLI tool (`index.ts`)
- **File-based storage**: Individual YAML files per control in `controls/<family>/` directories
- **Git integration**: Built-in git history tracking for all files
- **In-memory caching**: Controls and mappings cached for performance
- **WebSocket support**: Real-time updates for control changes

### Data Model

- **Controls**: Individual security controls stored as YAML files
- **Mappings**: Source code mappings to controls (stored in family-based YAML files)
- **Control Sets**: NIST 800-53 Rev 4 example included in `examples/`

### File Structure

```
examples/nist-800-53-v4-moderate/
├── lula.yaml                 # Control set metadata
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

- All file operations go through `FileStore` class (`cli/server/infrastructure/fileStore.ts`)
- Git operations handled by `GitHistoryUtil` (`cli/server/infrastructure/gitHistory.ts`)
- Server state management in `cli/server/serverState.ts`
- WebSocket communication in `cli/server/websocketServer.ts`

### Component Architecture

- Prefer composition over inheritance
- Use TypeScript interfaces defined in `src/lib/types.ts`
- Components in `src/components/` organized by feature area

## Testing

- Unit tests with Vitest
- Browser testing available via `@vitest/browser`
- Test files co-located with source (`.test.ts` suffix)

## Git-Friendly Design

- Individual YAML files per control enable meaningful diffs
- Git history integration shows file-level changes over time
- Spreadsheet import with customizable field mapping
- UUID-based mapping system for tracking code-to-control relationships

## NPM Package Details

- **Package name**: `lula2`
- **Binary name**: `lula2` 
- **Minimum Node version**: 22.0.0
- **Package type**: ESM module
- **Distribution**: Built CLI in `dist/` directory
