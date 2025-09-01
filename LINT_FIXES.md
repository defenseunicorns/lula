# Lint and Code Quality Fixes Summary

## Overview
This document outlines the lint errors and code quality improvements needed for the CYA compliance management system.

## Total Issues: 185 errors

### Critical Issues to Fix First

#### 1. WebSocket Server (`cli/websocketServer.ts`)
- **Issue**: Lexical declarations in case blocks (lines 28, 65)
- **Fix**: Wrap case blocks in `{}`
- **Issue**: Unused variables (lines 142, 257, 301, 434, 439)
- **Fix**: Remove or prefix with `_` if intentionally unused

#### 2. Type Safety Issues
Most files have `any` types that should be replaced:
- `cli/types.ts`: Define proper interfaces for all data structures
- `cli/spreadsheetRoutes.ts`: Type the spreadsheet data structures
- `src/lib/types.ts`: Ensure all frontend types are properly defined

#### 3. Unused Variables
- `cli/server.ts` line 23: Remove `wizardMode` variable
- `cli/infrastructure/gitHistory.ts` line 195: Remove `commitsToProcess`
- `src/routes/setup/+page.svelte` line 11: Remove `isLoading`

### Recommended Type Definitions

```typescript
// Replace 'any' types with these:
interface ControlData extends Record<string, unknown> {
  id: string;
  family?: string;
  title?: string;
  description?: string;
}

interface FieldMetadata {
  originalName: string;
  cleanName: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  maxLength: number;
  hasMultipleLines: boolean;
  uniqueValues: Set<unknown>;
  emptyCount: number;
  totalCount: number;
  examples: unknown[];
}

interface SpreadsheetRow extends Record<string, unknown> {
  // Dynamic fields from spreadsheet
}
```

### Code Structure Improvements

1. **Add comprehensive JSDoc comments**:
   - Document all public functions
   - Add @param, @returns, @throws tags
   - Include examples for complex functions

2. **Error handling**:
   - Use specific error types instead of generic Error
   - Add proper error logging with context
   - Implement error recovery strategies

3. **Code organization**:
   - Group related functions together
   - Extract complex logic into helper functions
   - Use consistent naming conventions

### Files to Refactor

Priority order:
1. `cli/websocketServer.ts` - Critical for real-time functionality
2. `cli/spreadsheetRoutes.ts` - Main import functionality
3. `cli/infrastructure/fileStore.ts` - Core data persistence
4. `src/lib/websocket.ts` - Frontend WebSocket client
5. Component files - Add proper prop types and event handlers

### Next Steps

1. Run `npx eslint src cli --fix` to auto-fix simple issues
2. Manually fix type safety issues
3. Add comprehensive documentation
4. Remove dead code
5. Run final lint check to verify all issues resolved

## Automation Script

To fix most issues automatically:
```bash
# Auto-fix what's possible
npx eslint src cli --fix

# Check remaining issues
npm run lint

# Run type check
npx tsc --noEmit
```