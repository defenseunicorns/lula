## Summary

This implementation adds detection for deleted files containing Lula compliance annotations (`@lulaStart`/`@lulaEnd`) in the crawl command.

### Changes Made

1. **Added `containsLulaAnnotations` function** - Checks if text content contains Lula annotations
2. **Enhanced crawl command** - Now detects when files with compliance annotations are deleted
3. **Compliance warning** - Automatically posts warnings about potential compliance impact when annotated files are deleted
4. **Comprehensive testing** - Added unit and integration tests for the new functionality

### How it Works

When the crawl command runs on a PR, it now:

1. **Scans all deleted files** (`status === 'removed'`)
2. **Fetches their content** from the base branch (usually `main`)
3. **Checks for Lula annotations** using `@lulaStart`/`@lulaEnd` patterns
4. **Posts a warning comment/review** if any deleted files contained compliance annotations

### Example Output

When a file with Lula annotations is deleted, the PR will receive a comment like:

```
⚠️ **Compliance Warning: Files with Lula annotations were deleted**

The following files contained compliance annotations (`@lulaStart`/`@lulaEnd`) and were deleted in this PR. This may affect compliance coverage:

- `config/secrets.yaml`
- `src/compliance-config.ts`

Please review whether:
- The compliance coverage provided by these files is still needed
- Alternative compliance measures have been implemented  
- The deletion is intentional and compliance-approved
```

### Usage

The functionality is automatically enabled in the existing crawl command:

```bash
# Review mode (default)
lula crawl --post-mode review

# Comment mode  
lula crawl --post-mode comment
```

No additional configuration is required - the crawl command will now automatically detect and warn about deleted files containing Lula annotations.
