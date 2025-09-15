// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Lula Authors

import { test, expect, type Page } from '@playwright/test';

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:3000';
const PATH = process.env.E2E_PATH ?? '/setup';

async function gotoAndWaitMounted({ page }: { page: Page }): Promise<void> {
	await page.goto(`${ORIGIN}${PATH}`, { waitUntil: 'domcontentloaded' });
	// Let the page settle a bit for FF/WebKit
	await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
	// Anchor on the Lula logo (most stable element on this page)
	await page.waitForSelector('img[alt="Lula"]', { timeout: 20000 });
	// Ensure onMount listeners are attached
	await page.evaluate(() => Promise.resolve());
}

test.describe('Setup Wizard', () => {
	test('default landing (no control sets)', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('control-sets-list', { detail: { controlSets: [] } }));
		});

		await expect(page.locator('img[alt="Lula"]')).toBeVisible();
		await expect(page.locator('#title')).toHaveText('Lula');

		await expect(page.locator('#description')).toContainText(
			"Let's get started by importing a control set from a spreadsheet.",
			{ timeout: 15000 }
		);

		await expect(page.getByTestId('pane-import')).toBeVisible();
	});

	test('shows tab UI when control sets exist (via CustomEvent)', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('control-sets-list', {
					detail: {
						controlSets: [
							{ path: '/sets/a', name: 'Alpha', description: 'A', controlCount: 3, file: 'a.json' },
							{ path: '/sets/b', name: 'Beta', description: 'B', controlCount: 7, file: 'b.json' }
						]
					}
				})
			);
		});

		await expect(page.locator('#description')).toContainText(
			'Select an existing control set or import a new one from a spreadsheet.',
			{ timeout: 15000 }
		);

		await expect(page.getByTestId('tab-existing')).toBeVisible();
		await expect(page.getByTestId('tab-import')).toBeVisible();
		await expect(page.getByTestId('pane-existing')).toBeVisible();
	});

	test('tab buttons toggle panes (no class assertions)', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('control-sets-list', {
					detail: {
						controlSets: [
							{ path: '/sets/a', name: 'Alpha', description: 'A', controlCount: 3, file: 'a.json' },
							{ path: '/sets/b', name: 'Beta', description: 'B', controlCount: 7, file: 'b.json' }
						]
					}
				})
			);
		});

		await expect(page.getByTestId('pane-existing')).toBeVisible();

		await page.getByTestId('tab-import').click();
		await expect(page.getByTestId('pane-import')).toBeVisible();

		await page.getByTestId('tab-existing').click();
		await expect(page.getByTestId('pane-existing')).toBeVisible();

		await expect(page.locator('#title')).toHaveText('Lula');
	});
});
