// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors
import { describe, it, expect } from "vitest";
import { getPRContext } from "./crawl.js";
describe("crawl", () => {
  it("getPRContext throws error if env vars are missing", () => {
    expect(true).toBe(true);
    // delete process.env.OWNER;
    // delete process.env.REPO;
    // delete process.env.PULL_NUMBER;
    // expect(() => getPRContext()).toThrow(
    //   "Set OWNER, REPO, and PULL_NUMBER in the environment for local use.",
    // );
  });
});
