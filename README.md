# Lula Next

[![Npm package license](https://badgen.net/npm/license/lula-next)](https://npmjs.com/package/lula-next)
[![Known Vulnerabilities](https://snyk.io/test/npm/lula-next/badge.svg)](https://snyk.io/advisor/npm-package/lula-next)
[![Npm package version](https://badgen.net/npm/v/lula-next)](https://npmjs.com/package/lula-next)
[![Npm package total downloads](https://badgen.net/npm/dt/lula-next)](https://npmjs.com/package/lula-next)

```bash
> OWNER=defenseunicorns REPO=on-demand-compliance  PULL_NUMBER=24 GITHUB_TOKEN=asdf npx tsx src/index.ts crawl
Commenting on file1.ts: **Compliance Alert**: `file1.ts` changed between lines 9–16.
UUID `123e4567-e89b-12d3-a456-426614174001` may be out of compliance. Please review.
POST /repos/defenseunicorns/on-demand-compliance/pulls/24/reviews - 422 with id D2F8:C840C:48C6221:933C86B:6890F9BC in 452ms
Error processing file1.ts: HttpError: Unprocessable Entity: "Can not request changes on your own pull request" - https://docs.github.com/rest/pulls/reviews#create-a-review-for-a-pull-request
Commenting on file1.yaml: **Compliance Alert**: `file1.yaml` changed between lines 16–18.
UUID `123e4567-e89b-12d3-a456-426614174000` may be out of compliance. Please review.
POST /repos/defenseunicorns/on-demand-compliance/pulls/24/reviews - 422 with id D2F8:C840C:48C656D:933CF0C:6890F9BC in 405ms
Error processing file1.yaml: HttpError: Unprocessable Entity: "Can not request changes on your own pull request" - https://docs.github.com/rest/pulls/reviews#create-a-review-for-a-pull-request



┌─[cmwylie19@C2WY6FCQVX] - [~/compliance-cli] - [2025-08-04 02:19:41]
└─[0] <git:(2 23e3aad) > OWNER=defenseunicorns REPO=on-demand-compliance  PULL_NUMBER=24 GITHUB_TOKEN=asdf npx tsx src/index.ts crawl
Commenting on file1.ts: **Compliance Alert**: `file1.ts` changed between lines 9–16.
UUID `123e4567-e89b-12d3-a456-426614174001` may be out of compliance. Please review.
Commenting on file1.yaml: **Compliance Alert**: `file1.yaml` changed between lines 16–18.
UUID `123e4567-e89b-12d3-a456-426614174000` may be out of compliance. Please review.
```
