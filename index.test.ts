// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025-Present The Lula2 Authors

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { getVersion } from "./index";

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: "1.2.3" })),
  },
}));
describe("lula2", () => {
  it("should return the current version (mocked)", () => {
    const version = getVersion();
    expect(version).toBe("1.2.3");

    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining("package.json"), "utf8");
  });
});
