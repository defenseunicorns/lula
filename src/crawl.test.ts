// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPRContext } from "./crawl.js";

const OLD_ENV = process.env;

describe("getPRContext", () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("throws error if env vars are missing", () => {
    delete process.env.OWNER;
    delete process.env.REPO;
    delete process.env.PULL_NUMBER;

    expect(() => getPRContext()).toThrowError(
      "Set OWNER, REPO, and PULL_NUMBER in the environment for local use.",
    );
  });

  it("returns context from fallback env vars", () => {
    process.env.OWNER = "defenseunicorns";
    process.env.REPO = "lula-next";
    process.env.PULL_NUMBER = "42";

    expect(getPRContext()).toEqual({
      owner: "defenseunicorns",
      repo: "lula-next",
      pull_number: 42,
    });
  });
});
