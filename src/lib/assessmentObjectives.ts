// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

/**
 * Utility functions for handling assessment objectives as mixed arrays (strings and nested objects)
 */

export function hasAssessmentObjectives(objectives: any[] | null | undefined): boolean {
	return !!(objectives && Array.isArray(objectives) && objectives.length > 0);
}
