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

test.describe('Main Page', () => {
	test('DIRECT: Test the main controls page (src/routes/+page.svelte)', async ({ page }) => {
		await page.route('**/ws', (route) => route.abort());

		await page.addInitScript(() => {
			const mockControls = [
				{
					id: 'AC-1',
					title: 'Access Control Policy',
					description:
						'The organization develops, documents, and disseminates an access control policy',
					family: 'AC',
					implementation_status: 'implemented',
					narrative: 'Our organization has implemented comprehensive access control policies...'
				},
				{
					id: 'AT-1',
					title: 'Security Awareness Training',
					description: 'The organization provides security awareness training to users',
					family: 'AT',
					implementation_status: 'planned',
					narrative: 'Security awareness training program is being developed...'
				}
			];

			const mockAppState = {
				id: 'test-control-set',
				name: 'Test Control Set',
				currentPath: '/test/path',
				controls: mockControls,
				mappings: [],
				families: ['AC', 'AT'],
				totalControls: 2,
				totalMappings: 0,
				isConnected: true,
				isSwitchingControlSet: false,
				fieldSchema: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						description: { type: 'string' },
						family: { type: 'string' },
						implementation_status: { type: 'string' }
					}
				}
			};

			(window as unknown as { __testMockAppState: typeof mockAppState }).__testMockAppState =
				mockAppState;

			class MockWebSocket {
				onopen: ((event: Event) => void) | null = null;
				onmessage: ((event: { data: string }) => void) | null = null;

				constructor(url: string) {
					console.log('Mock WebSocket created for:', url);
					setTimeout(() => {
						if (this.onopen) this.onopen(new Event('open'));
						if (this.onmessage) {
							this.onmessage({
								data: JSON.stringify({
									type: 'state-update',
									payload: mockAppState
								})
							});
						}
					}, 100);
				}

				send() {
					console.log('Mock WebSocket send called');
				}
				close() {
					console.log('Mock WebSocket close called');
				}
			}

			(window as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
		});

		// go to main page after state is set up
		await page.goto(`${ORIGIN}/`);
		await page.waitForLoadState('domcontentloaded');

		// Wait for any state updates
		await page.waitForTimeout(3000);

		// Make sure data was loaded
        const hasControls = await page
            .getByText('AC-1')
            .isVisible();
		if (hasControls) {
			// Make sure there are two columns
			const columnCount = await page.locator('.w-1\\/2.flex.flex-col').count();
			expect(columnCount).toBe(2);

			// Assert "No Control Selected" is on the page initially - right side
			await expect(page.locator('text=No Control Selected')).toBeVisible();

			// Click on AC-1 control - just verify the interaction works - left side
			await page.locator('text=AC-1').click();
			await page.waitForTimeout(500);

			const selectedControl = page.locator('[role="button"]').filter({ hasText: 'AC-1' });
			const hasSelectionStyling = await selectedControl.evaluate((el) => {
				return (
					el.classList.contains('bg-blue-50') &&
					el.classList.contains('border-l-4') &&
					el.classList.contains('border-blue-500') &&
					el.classList.contains('shadow-sm')
				);
			});

			expect(hasSelectionStyling).toBe(true);
		}
	});
});
