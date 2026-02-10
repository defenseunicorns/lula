// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { test, expect, type Page } from '@playwright/test';

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:3000';
const PATH = process.env.E2E_PATH ?? '/';

async function gotoAndWaitMounted({ page }: { page: Page }): Promise<void> {
	await page.goto(`${ORIGIN}${PATH}`, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
	await page.waitForSelector('div[class*="w-1/2"]', { timeout: 20000 });
	await page.evaluate(() => Promise.resolve());
}

test.describe('Main Page', () => {
	test('displays two-column layout with controls list and details panel', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		// main columns should be visible
		const leftPane = page.locator('div[class*="w-1/2"]').first();
		const rightPane = page.locator('div[class*="w-1/2"]').last();

		await expect(leftPane).toBeVisible();
		await expect(rightPane).toBeVisible();

		// left column have the controls list card
		await expect(leftPane.locator('div.bg-white.border.rounded-lg').first()).toBeVisible();
	});

	test('shows placeholder message when no control is selected', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		const rightPane = page.locator('div[class*="w-1/2"]').last();
		await expect(rightPane.locator('h3')).toContainText('No Control Selected');
		await expect(rightPane.locator('p')).toContainText(
			'Select a control from the list to view and edit its details'
		);
		await expect(rightPane.locator('svg')).toBeVisible();
	});

	test('displays control details panel when a control is selected', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		const leftPane = page.locator('div[class*="w-1/2"]').first();
		const rightPane = page.locator('div[class*="w-1/2"]').last();

		const firstControl = leftPane.locator('[data-testid="control-item"]').first();
		await firstControl.click();

		await expect(rightPane.locator('h3')).not.toContainText('No Control Selected');
		await expect(rightPane.locator('[data-testid="control-details"]')).toBeVisible();
	});
	test('maintains responsive layout with proper column widths', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		// Check that both columns have the correct width classes
		const columns = page.locator('div[class*="w-1/2"]');
		await expect(columns).toHaveCount(2);

		// Verify each column has the flex-col class for vertical layout
		await expect(columns.first()).toHaveClass(/flex-col/);
		await expect(columns.last()).toHaveClass(/flex-col/);
	});

	test('left pane contains properly styled controls list card', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		const leftPane = page.locator('div[class*="w-1/2"]').first();
		const card = leftPane.locator('div.bg-white.border.rounded-lg').first();

		// Verify card styling
		await expect(card).toHaveClass(/border/);
		await expect(card).toHaveClass(/border-gray-200/);
		await expect(card).toHaveClass(/dark:border-gray-700/);
		await expect(card).toHaveClass(/rounded-lg/);
		await expect(card).toHaveClass(/shadow-sm/);
		await expect(card).toHaveClass(/h-full/);
		await expect(card).toHaveClass(/flex/);
		await expect(card).toHaveClass(/flex-col/);
	});

	test('placeholder content has correct styling and accessibility', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		// Check placeholder content in default state
		const rightPane = page.locator('div[class*="w-1/2"]').last();
		const placeholderContainer = rightPane.locator('.flex.items-center.justify-center');

		// Check container styling
		await expect(placeholderContainer).toHaveClass(/flex-1/);
		await expect(placeholderContainer).toHaveClass(/p-8/);

		// Check text center alignment
		const textContainer = placeholderContainer.locator('.text-center');
		await expect(textContainer).toBeVisible();

		// Verify heading accessibility and styling
		const heading = textContainer.locator('h3');
		await expect(heading).toHaveClass(/text-xl/);
		await expect(heading).toHaveClass(/font-semibold/);
		await expect(heading).toHaveClass(/text-gray-900/);
		await expect(heading).toHaveClass(/dark:text-white/);

		// Verify description text styling
		const description = textContainer.locator('p');
		await expect(description).toHaveClass(/text-gray-600/);
		await expect(description).toHaveClass(/dark:text-gray-400/);
	});
});
