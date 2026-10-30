// Run against a local production build: node --test scripts/audit/seller-calculator-navigation.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';

const base = process.env.LEGACY_REDIRECTS_BASE || 'http://127.0.0.1:4321';
const calculatorPath = '/sell/seller-net-proceeds-calculator/';

for (const [device, width] of [['desktop', 1320], ['mobile', 390]]) {
	test(`seller-net-proceeds-calculator is reachable from ${device} Sellers navigation`, async () => {
		const browser = await chromium.launch({ headless: true, executablePath: process.env.LEGACY_REDIRECTS_CHROMIUM });
		try {
			const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
			await page.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin
				? route.continue() : route.abort());
			const response = await page.goto(new URL('/sell/', base).href, { waitUntil: 'domcontentloaded' });
			assert.equal(response.status(), 200);
			assert.equal(await page.getByRole('link', { name: /Estimate your potential sale proceeds/ }).getAttribute('href'), calculatorPath);

			const nav = page.locator(`nav[aria-label="${device === 'desktop' ? 'Main navigation' : 'Mobile navigation'}"]`);
			if (device === 'desktop') {
				await nav.getByRole('link', { name: 'Sellers', exact: true }).focus();
				await page.keyboard.press('Tab');
			} else {
				await page.locator('#mobile-menu-toggle').click();
			}
			const link = nav.getByRole('link', { name: 'Seller Net Proceeds Calculator' });
			assert.equal(await link.getAttribute('href'), calculatorPath);
			assert.equal(await link.isVisible(), true);
			if (device === 'desktop') assert.equal(await link.evaluate((element) => document.activeElement === element), true);
			await link.scrollIntoViewIfNeeded();
			await link.click();
			await page.waitForURL(new URL(calculatorPath, base).href);
			assert.equal(await page.getByRole('heading', { name: /Seller net proceeds calculator/i, level: 1 }).count(), 1);
		} finally {
			await browser.close();
		}
	});
}
