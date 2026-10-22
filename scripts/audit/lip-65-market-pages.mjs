#!/usr/bin/env node
/**
 * Local browser regression check for the LIP-65 market pages.
 *
 * Usage after a local build and preview:
 *   node scripts/audit/lip-65-market-pages.mjs --base http://127.0.0.1:4322 --canonical-origin http://127.0.0.1:4321
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const routes = [
	'/',
	'/buy/',
	'/sell/',
	'/northwest-houston-real-estate/',
	'/northwest-houston-real-estate/cypress-tx-real-estate/',
];

const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 375, height: 812 },
];

function optionValue(argv, name) {
	const position = argv.indexOf(name);
	return position < 0 ? undefined : argv[position + 1];
}

function parseArgs(argv) {
	const usage = 'Usage: node scripts/audit/lip-65-market-pages.mjs --base <local-preview-url> [--canonical-origin <site-origin>]';
	const baseValue = optionValue(argv, '--base');
	assert.ok(baseValue, usage);
	const base = new URL(baseValue);
	assert.ok(['http:', 'https:'].includes(base.protocol), 'Preview URL must use HTTP or HTTPS');
	const canonicalOrigin = new URL(optionValue(argv, '--canonical-origin') ?? base.origin);
	assert.ok(['http:', 'https:'].includes(canonicalOrigin.protocol), 'Canonical origin must use HTTP or HTTPS');
	return { base: base.toString(), canonicalOrigin: canonicalOrigin.origin };
}

async function readTable(page, selector) {
	return page.locator(selector).evaluate((node) => ({
		caption: node.querySelector('caption')?.textContent?.trim(),
		columnHeaders: [...node.querySelectorAll('thead th')].map((header) => ({
			text: header.textContent?.trim(),
			scope: header.getAttribute('scope'),
		})),
		rowHeaders: [...node.querySelectorAll('tbody th')].map((header) => header.getAttribute('scope')),
	}));
}

async function assertAccessibleTable(page, selector, expectedColumnCount, expectedHeaders) {
	const table = await readTable(page, selector);
	assert.ok(table.caption, `${selector} should have a caption`);
	assert.equal(table.columnHeaders.length, expectedColumnCount, `${selector} should retain ${expectedColumnCount} columns`);
	assert.ok(table.columnHeaders.every(({ scope }) => scope === 'col'), `${selector} column headers should identify their columns`);
	assert.equal(table.rowHeaders.length, 6, `${selector} should retain six city row headers`);
	assert.ok(table.rowHeaders.every((scope) => scope === 'row'), `${selector} row headers should identify their rows`);
	if (expectedHeaders) assert.deepEqual(table.columnHeaders, expectedHeaders);
}

async function assertRegionalComparison(page) {
	await assertAccessibleTable(page, '.regional-market-comparison table', 3, [
		{ text: 'Area', scope: 'col' },
		{ text: 'Active listing median', scope: 'col' },
		{ text: 'Median listing age', scope: 'col' },
	]);
}

async function assertCommunityComparison(page) {
	await assertAccessibleTable(page, '#communities table', 5);
}

const tableAssertions = new Map([
	['/', assertRegionalComparison],
	['/buy/', assertRegionalComparison],
	['/sell/', assertRegionalComparison],
	['/northwest-houston-real-estate/', assertCommunityComparison],
]);

function assertPageBasics(result, route, canonicalOrigin, viewport) {
	assert.equal(result.canonical.length, 1, `${route} should emit exactly one canonical link`);
	assert.equal(result.canonical[0], new URL(route, canonicalOrigin).toString(), `${route} should retain its canonical path`);
	assert.equal(result.mainCount, 1, `${route} should expose one main landmark`);
	assert.equal(result.h1Count, 1, `${route} should expose one page heading`);
	assert.deepEqual(result.missingAlt, [], `${route} should give each image an alt attribute`);
	assert.ok(result.documentWidth <= result.viewportWidth + 1, `${route} should not overflow horizontally at ${viewport.name}`);
}

async function inspectPage(page, { base, canonicalOrigin, route, viewport }) {
	const response = await page.goto(new URL(route, base).toString(), { waitUntil: 'load', timeout: 45_000 });
	assert.equal(response?.status(), 200, `${route} should return HTTP 200 at ${viewport.name}`);
	await page.locator('main').waitFor({ state: 'visible', timeout: 10_000 });

	const result = await page.evaluate(() => {
		const canonical = [...document.querySelectorAll('link[rel="canonical"]')].map((link) => link.href);
		const mainCount = document.querySelectorAll('main, [role="main"]').length;
		const h1Count = document.querySelectorAll('h1').length;
		const missingAlt = [...document.querySelectorAll('img:not([alt])')].map((image) => image.currentSrc || image.src);
		const viewportWidth = document.documentElement.clientWidth;
		const documentWidth = document.documentElement.scrollWidth;
		return { canonical, mainCount, h1Count, missingAlt, viewportWidth, documentWidth };
	});

	assertPageBasics(result, route, canonicalOrigin, viewport);
	await tableAssertions.get(route)?.(page);

	console.log(`PASS ${viewport.name} ${route}: canonical, landmarks, headings, image alt, and width`);
}

async function main() {
	const { base, canonicalOrigin } = parseArgs(process.argv);
	const executablePath = process.env.LIP_65_CHROME_PATH;
	const browser = await chromium.launch(executablePath
		? { executablePath, args: ['--no-sandbox'] }
		: {});
	try {
		for (const viewport of viewports) {
			const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
			// The audit only needs the built pages; skip the production GTM request.
			await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
			for (const route of routes) await inspectPage(page, { base, canonicalOrigin, route, viewport });
			await page.close();
		}
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
