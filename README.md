# Lula Next

[![Npm package license](https://badgen.net/npm/license/lula-next)](https://npmjs.com/package/lula-next)
[![Known Vulnerabilities](https://snyk.io/test/npm/lula-next/badge.svg)](https://snyk.io/advisor/npm-package/lula-next)
[![Npm package version](https://badgen.net/npm/v/lula-next)](https://npmjs.com/package/lula-next)
[![Npm package total downloads](https://badgen.net/npm/dt/lula-next)](https://npmjs.com/package/lula-next)

**Crawl Command**

```bash
> OWNER=defenseunicorns REPO=on-demand-compliance  PULL_NUMBER=24 GITHUB_TOKEN=$(gh auth token) npx lula2 crawl
Commenting on file1.ts: **Compliance Alert**: `file1.ts` changed between lines 9–16.
UUID `123e4567-e89b-12d3-a456-426614174001` may be out of compliance. Please review.
Commenting on file1.yaml: **Compliance Alert**: `file1.yaml` changed between lines 16–18.
UUID `123e4567-e89b-12d3-a456-426614174000` may be out of compliance. Please review.
```

**Version Command**

```bash
> npx lula2 --version
```
