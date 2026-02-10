import { test, expect, type Page } from '@playwright/test';

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:3000';

async function gotoAndWaitMounted({ page }: { page: Page }): Promise<void> {
	await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
	await page.evaluate(() => Promise.resolve());
}

test.describe('Main Page', () => {
	test('displays two-column layout', async ({ page }) => {
		await gotoAndWaitMounted({ page });
		
		const leftPane = page.locator('.w-1\\/2').first();
		const rightPane = page.locator('.w-1\\/2').last();
		
		await expect(leftPane).toBeVisible();
		await expect(rightPane).toBeVisible();
	});

	test('shows no control selected state initially', async ({ page }) => {
		await gotoAndWaitMounted({ page });
		
		await expect(page.getByText('No Control Selected')).toBeVisible();
		await expect(page.getByText('Select a control from the list to view and edit its details')).toBeVisible();
	});

	test('shows control details when selected', async ({ page }) => {
		await gotoAndWaitMounted({ page });
		
		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('control-details', {
				detail: {
					id: 'AC-1',
					title: 'Access Control Policy',
					family: 'Access Control'
				}
			}));
		});

		await expect(page.getByText('No Control Selected')).not.toBeVisible();
	});

	test('state changes between different controls', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('control-details', {
				detail: { id: 'AC-1', title: 'First Control' }
			}));
		});

		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('control-details', {
				detail: { id: 'AC-2', title: 'Second Control' }
			}));
		});

		await expect(page.getByText('First Control')).not.toBeVisible();
	});

	test('returns to no selection state when control deselected', async ({ page }) => {
		await gotoAndWaitMounted({ page });

		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('control-details', {
				detail: { id: 'AC-1', title: 'Test Control' }
			}));
		});

		await page.evaluate(() => {
			window.dispatchEvent(new CustomEvent('control-details', {
				detail: null
			}));
		});

		await expect(page.getByText('No Control Selected')).toBeVisible();
	});
});
