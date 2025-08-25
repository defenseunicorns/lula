# Contributor Guide

Thank you for your interest in contributing to Kubernetes Fluent Client! We welcome all contributions and are grateful for your help. This guide outlines how to get started with contributing to this project.

## Table of Contents

- [Contributor Guide](#contributor-guide)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Setup](#setup)
  - [Submitting a Pull Request](#submitting-a-pull-request)
    - [PR Requirements](#pr-requirements)
  - [Coding Guidelines](#coding-guidelines)
  - [Running Tests](#running-tests)
    - [Run Tests Locally](#run-tests-locally)
  - [Contact](#contact)

## Code of Conduct

Please follow our [Code of Conduct](./CODE_OF_CONDUCT.md) to maintain a respectful and collaborative environment.

## Getting Started

- **Repository**: [https://github.com/defenseunicorns/kubernetes-fluent-client/](https://github.com/defenseunicorns/kubernetes-fluent-client/)
- **npm package**: [https://www.npmjs.com/package/kubernetes-fluent-client](https://www.npmjs.com/package/kubernetes-fluent-client)
- **Required Node version**: `>=20.0.0`

### Setup

1. Fork the repository.
2. Clone your fork locally: `git clone https://github.com/your-username/kubernetes-fluent-client.git`.
3. Install dependencies: `npm ci`.
4. Create a new branch for your feature or fix: `git checkout -b my-feature-branch`.

## Submitting a Pull Request

1. **Create an Issue**: For significant changes, please create an issue first, describing the problem or feature proposal. Trivial fixes, such as typo corrections, do not require an issue.
2. **Commit Your Changes**: Make your changes and commit them. All commits must be signed.
3. **Run Tests**: Ensure that your changes pass all tests by running unit tests (`npm test`) and integration tests (`test:e2e:run`).
4. **Push Your Branch**: Push your branch to your fork on GitHub.
5. **Create a Pull Request**: Open a pull request against the `main` branch of the Kubernetes Fluent Client repository. Please make sure that your PR passes all CI checks.

### PR Requirements

- PRs must be against the `main` branch.
- PRs must pass CI checks.
- Ensure all commits in your PR are signed.
- PRs should have a related issue, except for trivial fixes.

## Coding Guidelines

Please follow the coding conventions and style used in the project. Use ESLint and Prettier for linting and formatting:

- Check formatting: `npm run format:check`
- Fix formatting: `npm run format:fix`

## Running Tests

### Run Tests Locally

- Unit: `npm test`
- End to end: `npm run test:e2e:run`

### Running Development Version Locally

1. Run `npm run build` to build the package.
2. For CLI, you can run `npx ts-node src/cli.ts`.
3. To consume the package in another project, you can run `npm pack` to generate the `kubernetes-fluent-client-0.0.0-development.tgz`, then you can install with `npm i kubernetes-fluent-client-0.0.0-development.tgz --no-save`.

> [!TIP]
> Make sure to re-run `npm run build` after you modify any of the Kubernetes Fluent Client source files.

## Contact

For any questions or concerns, please open an issue on GitHub or contact the maintainers.
