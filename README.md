# Lula - GitOps for Compliance

<img src="static/lula.png" alt="Lula Logo" width="150" align="right" />

> [!IMPORTANT]
> This project is still in its early stages. Expect breaking changes.
>
> Looking for the original Lula OSCAL compliance validator? Go to [defenseunicorns-labs/lula1](https://github.com/defenseunicorns-labs/lula1)
>
> _Lula 1 is in maintenance mode and not receiving active updates or new features._

[![Npm package license](https://badgen.net/npm/license/lula-next)](https://npmjs.com/package/lula-next)
[![Known Vulnerabilities](https://snyk.io/test/npm/lula-next/badge.svg)](https://snyk.io/advisor/npm-package/lula-next)
[![Npm package version](https://badgen.net/npm/v/lula-next)](https://npmjs.com/package/lula-next)
[![Npm package total downloads](https://badgen.net/npm/dt/lula-next)](https://npmjs.com/package/lula-next)
[![codecov](https://codecov.io/gh/defenseunicorns/lula/graph/badge.svg?token=FZV3DSS8NF)](https://codecov.io/gh/defenseunicorns/lula)

Bring GitOps principles to compliance management. Lula treats security controls as code, enabling teams to manage compliance frameworks (NIST 800-53, CIS, SOC2) through pull requests, code reviews, and automated workflows—just like your application code in a user-friendly web interface. Your data stays your data--Lula takes spreadsheet imports, lets you drag & drop the UI layout and version control the data as yaml automatically for you.

## Quickstart

Run Lula directly with npx (no installation required):

```bash
npx lula2
```

**Import an eMASS Spreadsheet**

The first step is to import an eMASS spreadsheet into Lula. A sample file is provided at: [samples/fake-controls.xlsx](samples/fake-controls.xlsx)

**Continue with Lula Workflow**

Once the spreadsheet is imported, you can proceed with the standard Lula workflow creating mappings to controls.

## Why GitOps for Compliance?

- **Version Everything**: Every control change, ui change, mapping is tracked, reviewable, and revertable
- **Pull Request Workflows**: Review compliance changes before they go live
- **Branch Strategies**: Test control changes in isolated branches
- **Automated Validation**: CI/CD pipelines can validate control completeness
- **Audit Trail**: Git history provides immutable audit logs
- **Collaborative Review**: Security, compliance, and engineering teams collaborate through PRs
- **Automated Change Detection**: Map controls to source code via generated UUIDs and track when code changes impact your compliance posture

## Key Features

- **Controls as Code**: Each control stored as an individual YAML file
- **Import/Export**: Import any generic spreadsheet with column headers, including from tools like EMASS
- **Smart Formatting**: Automatic text processing for control descriptions and procedures
- **Source Mappings**: Link controls to actual code implementations
- **Multi-Framework**: Support NIST, CIS, SOC2, and custom frameworks in one repo
- **Git Timeline**: Visual history of all control changes

## Interface Features

Once launched, you can:

- **Browse Controls**: Navigate through control families and individual controls
- **Edit Controls**: Update implementation narratives, status, and properties
- **Track Changes**: View Git history and timeline for each control
- **Manage Mappings**: Link controls to source code and documentation
- **Import Data**: Use the setup page to import OSCAL catalogs or existing control sets
- **Export Reports**: Generate compliance reports and assessments

## Learning from Lula 1

We built Lula 2 after discovering key limitations with the OSCAL-based approach:

**Challenges in Lula 1:**

- OSCAL proved too complex for most teams to work with effectively
- Automated tests alone were insufficient for real compliance verification
- The format made collaboration and review difficult

**Lula 2's Approach:**

- **Simple YAML + Spreadsheets**: Import from any spreadsheet tool (including EMASS), no OSCAL knowledge required
- **Human + AI Analysis**: Recognizes that compliance requires human judgment augmented by AI reasoning, not just automated tests
- **Git-native**: Use standard diff tools and pull requests for review
- **Web UI**: Intuitive interface that anyone can use, not just CLI experts
- **Change Impact Tracking**: Maps controls to actual code and tracks when changes might affect compliance

This evolution reflects our learning that effective compliance management needs to be accessible to all stakeholders—not just those who can navigate complex standards or write validation code.

## Commands

### UI Command

By default, the web interface is launched as the root command, but if you need to provide configuration flags:

```bash
> npx lula2 ui
```

### Crawl Command

Analyze pull requests for compliance impact:

```bash
> OWNER=defenseunicorns REPO=lula  PULL_NUMBER=126 GITHUB_TOKEN=$(gh auth token) npx lula2 crawl --post-mode=comment                   
Analyzing PR #126 in defenseunicorns/lula for compliance changes...
Commenting regarding `integration/test-files/ex.ts`.
Commenting regarding `integration/test-files/ex.yaml`.

Posted (comment)
----------------

## Lula Compliance Overview

Please review the changes to ensure they meet compliance standards.

### Reviewed Changes

Lula reviewed 2 files changed that affect compliance.



---
| File | Lines Changed |
| ---- | ------------- |
| `integration/test-files/ex.ts` | `20–31` |
> **uuid**-`123e4567-e89b-12d3-a456-426614174000`
 **sha256** `f889702fd3330d939fadb5f37087948e42a840d229646523989778e2b1586926`



---
| File | Lines Changed |
| ---- | ------------- |
| `integration/test-files/ex.yaml` | `1–5` |
> **uuid**-`123e4567-e89b-12d3-a456-426614174001`
 **sha256** `f6b6f51335248062b003696623bfe21cea977ca7f4e4163b182b0036fa699eb4`



---

<sub>**Tip:** Customize your compliance reviews with <a href="https://github.com/defenseunicorns/lula.git" class="Link--inTextBlock" target="_blank" rel="noopener noreferrer">Lula</a>.</sub>
```


Here is a workflow example for GitHub Actions:

```yaml

# This workflow runs a Lula scan against the PR to see if compliance has changed

name: Lula Scan
on:
  pull_request:
    branches: ["main"]
    types: [opened, reopened, synchronize]
permissions:
  contents: read
  pull-requests: write

jobs:
  scan-pr:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@ff7abcd0c3c05ccf6adc123a8cd1fd4fb30fb493
      - name: Use Node.js 22
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: 22

      - name: Run Lula Scan
        run: |
          npx --yes lula2 crawl
        shell: bash
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Version Command

```bash
> npx lula2 --version
```

## Project Structure

Lula organizes controls in a Git-friendly structure:

```
my-compliance-project/
├── lula.yaml                    # Control set metadata
├── controls/                    # Individual control files
│   ├── AC/                      # Access Control family
│   │   ├── AC-1.yaml
│   │   ├── AC-2.yaml
│   │   └── AC-2_1.yaml         # Control enhancements
│   ├── AU/                      # Audit family
│   │   └── ...
│   └── ...
└── mappings/                    # Source code mappings
    ├── AC/
    │   └── AC-1-mappings.yaml
    └── ...
```

### Control File Format

Each control is stored as a YAML file with a consistent schema based on the imported spreadsheet:

```yaml
id: AC-1
title: Access Control Policy and Procedures
family: AC
description: |
  The organization develops, documents, and disseminates...
implementation_status: Implemented
security_control_designation: Hybrid
control_implementation_narrative: |
  Our organization implements AC-1 through...
implementation_guidance: |
  Step-by-step guidance for implementing this control...
assessment_procedures: |
  Methods for assessing control effectiveness...
test_results: |
  Results from the latest assessment...
properties:
  priority: P1
  responsible_role: CISO
  last_reviewed: 2024-01-15
```

## Features in Detail

### GitOps Workflow

Manage compliance like code with full GitOps practices:

```bash
# Create feature branch for control updates
git checkout -b update-ac-controls

# Make changes through Lula UI
npx lula2

# Commit changes
git add controls/
git commit -m "Updated AC family implementation narratives"

# Push and create PR
git push origin update-ac-controls
# → Team reviews changes in PR
# → CI validates control completeness
# → Merge when approved
```

### Smart Text Processing

Lula automatically formats complex text fields:

- Detects and styles headers (Description:, Guidance:, etc.)
- Converts CSV data into formatted tables
- Properly formats lists and bullet points
- Highlights control IDs and CCI references

### Control Mappings

Link controls to actual implementations using a UUID:

```yaml
- control_id: AC-10_3
  justification: 'This is my reason this is compliant'
  status: implemented
  source_entries: [source: src/auth/policies.ts]
  uuid: 439489d2-c1db-4ab4-a4dd-d0a6f4a0dd24
  last_validated: 2024-01-15
```

## GitOps Benefits for Compliance

### For Compliance Teams

- **Review Process**: Control changes go through pull request reviews
- **Rollback**: Instantly revert problematic control updates
- **Branching**: Test control changes without affecting production
- **History**: Complete audit trail in Git log
- **Protection**: Leverage `CODEOWNERS` to limit who can edit controls/mappings or change the UI
- **Monitoring**: Leverage SCM tools to track key changes/issues

### For Security Engineers

- **Infrastructure as Code**: Compliance configurations alongside IaC
- **Automation**: Trigger compliance checks on control changes
- **Integration**: Controls in the same repo as security policies
- **Validation**: Pre-commit hooks for control completeness

### For Auditors

- **Immutable History**: Git provides tamper-evident audit logs when combined with SCM tooling
- **Change Attribution**: Every change linked to a person and reason
- **Point-in-Time**: View controls as they were at any date
- **Evidence Chain**: PRs document review and approval process

## Configuration

### `lula.yaml`

Managed by the UI for you, each control set includes a configuration file:

```yaml
name: NIST 800-53 Rev 4 Moderate
version: 4.0.0
description: NIST Special Publication 800-53 Security Controls
source: https://csrc.nist.gov/publications/detail/sp/800-53/rev-4/final
families:
  - id: AC
    name: Access Control
  - id: AU
    name: Audit and Accountability
  # ... more families
```

## Troubleshooting

### Common Issues

**No control sets found:**

- Ensure you have a `lula.yaml` file in your control set directory
- Check that control files are in the correct structure

**WebSocket connection failed:**

- Verify the port is not in use
- Check firewall settings
- Ensure both frontend and backend are running

**Git history not showing:**

- Verify the directory is a Git repository
- Ensure Git is installed and accessible
- Check file permissions

## Development

### Prerequisites

- Node.js 22+
- Git (for version history features)
- pnpm (recommended) or npm

### Local Development

```bash
# Clone the repository
git clone https://github.com/defenseunicorns/lula.git
cd lula

# Install dependencies
pnpm install

# Run development servers
pnpm run dev:full  # Runs both frontend and backend
```

### Build

```bash
pnpm run build
```

## Architecture

- **Frontend**: SvelteKit 5 with Tailwind CSS
- **Backend**: Express + WebSocket server
- **Storage**: YAML files with Git integration
- **State Management**: Svelte 5 runes
- **CLI**: Commander.js with TypeScript

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 - See [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [https://lula.dev/docs](https://lula.dev/docs)
- **Issues**: [GitHub Issues](https://github.com/defenseunicorns/lula2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/defenseunicorns/lula2/discussions)

## Related Projects

- [Lula 1 (Original CLI)](https://github.com/defenseunicorns-labs/lula1) - OSCAL-based compliance validator CLI
- [OSCAL](https://pages.nist.gov/OSCAL/) - Open Security Controls Assessment Language

## Credits

Developed by [The Lula Authors](https://github.com/defenseunicorns/lula2/graphs/contributors)

Part of the Defense Unicorns ecosystem for secure, compliant software delivery.
