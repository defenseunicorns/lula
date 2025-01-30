# Lula Release Process

This document provides guidance on how to create Lula releases, address release issues, and other helpful tips.

This project uses [goreleaser](https://github.com/goreleaser/goreleaser-action) for releasing binaries and [release-please](https://github.com/marketplace/actions/release-please-action) for creating release PR's.

## Release Cadence

The Lula release cadence aims to happen every 2 weeks at a minimum.

## Release Checklist

- [ ] Ensure a [milestone](https://github.com/defenseunicorns/lula/milestones) exists for the intended release version
- [ ] Review Open [Pull Requests](https://github.com/defenseunicorns/lula/pulls)
  - [ ] Identify any candidates to be merged - Review PR milestone to determine intent
  - [ ] Review all [renovate](https://github.com/defenseunicorns/lula/pulls?q=is%3Apr+is%3Aopen+renovate) Pull Requests. Determine if the update can be applied or if it should be reviewed further.
- [ ] Add the identified release milestone to the [Release Please](https://github.com/defenseunicorns/lula/pulls?q=is%3Apr+is%3Aopen+label%3A%22autorelease%3A+pending%22) Pull Request
  - [ ] Ensure all tests pass
  - [ ] Review the Pull Request content - ensuring all merged Pull Requests are accounted
  - [ ] Approve and Merge the Pull Request
- [ ] Ensure Release Please creates the new Tag
- [ ] Review the Draft release
  - [ ] Add a summary of the release updates and any required documentation around updates or breaking changes
  - [ ] Publish the release as the latest release
- [ ] Ensure go-releaser workflows execute successfully
  - [ ] Review the release assets
- [ ] Review, Approve, and Merge the [homebrew-tap](https://github.com/defenseunicorns/homebrew-tap) Pull Request for Lula release

## Release Issues

### A release is "broken" and should not be used

Rather than removing a release that is deemed to be broken in some fashion, it should be noted as a broken release in the release notes as soon as possible, and a new release created that fixes the issue(s).

The CHANGELOG is not required to be updated, only the release notes must be updated either manually or with CI automation.

- Manual approach: Find the impacted release, edit the release notes, and put this warning at the top:

```md
>[!WARNING]
>PLEASE USE A NEWER VERSION (there are known issues with this release)
```
