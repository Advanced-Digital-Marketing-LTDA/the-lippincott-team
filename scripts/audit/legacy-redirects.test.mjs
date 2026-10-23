// Run against a local production build: node --test scripts/audit/legacy-redirects.test.mjs
// Override the default origin with LEGACY_REDIRECTS_BASE when needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';

const base = process.env.LEGACY_REDIRECTS_BASE || 'http://127.0.0.1:4321';
const redirects = [
	['/agents/amy-lippincott/', '/about/amy-lippincott-2/'],
	['/contact/', '/contact-us/'],
];

for (const [source, destination] of redirects) {
	test(`${source} emits one HTTP 301, preserves queries, and reaches a canonical page`, async () => {
		const query = '?utm_source=Google%20Search&tag=a&tag=b&empty=&next=https%3A%2F%2Fexample.org%2F';
		for (const path of [source, source.slice(0, -1)]) {
			for (const method of ['GET', 'HEAD']) {
				const response = await fetch(new URL(path + query, base), { method, redirect: 'manual' });
				assert.equal(response.status, 301, `${method} ${path}`);
				assert.equal(response.headers.get('location'), destination + query);
				const target = await fetch(new URL(response.headers.get('location'), base), { method, redirect: 'manual' });
				assert.equal(target.status, 200, 'Destination must not redirect again or return a soft 404');
				if (method === 'GET') {
					const html = await target.text();
					assert.match(html, /<h1[\s>]/);
					assert.ok(html.includes(`<link rel="canonical" href="https://thelippincottteam.com${destination}"`));
				}
			}
		}
	});

	test(`${source} preserves query and fragment through browser navigation`, async () => {
		const browser = await chromium.launch({ headless: true, executablePath: process.env.LEGACY_REDIRECTS_CHROMIUM });
		try {
			const page = await browser.newPage();
			// This check needs only the local build, so block third-party scripts/media.
			await page.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin
				? route.continue() : route.abort());
			const suffix = '?utm_source=audit&tag=a&tag=b#contact-ledger';
			const response = await page.goto(new URL(source + suffix, base).href, { waitUntil: 'domcontentloaded' });
			assert.equal(response.status(), 200);
			assert.equal(page.url(), new URL(destination + suffix, base).href);
			const originalRequest = response.request().redirectedFrom();
			assert.ok(originalRequest, 'Browser must receive an HTTP redirect');
			assert.equal((await originalRequest.response()).status(), 301);
			assert.equal(originalRequest.redirectedFrom(), null, 'No redirect chain');
		} finally {
			await browser.close();
		}
	});
}

test('legacy WordPress image URL emits one HTTP 301 and reaches the replacement asset', async () => {
	const source = '/wp-content/uploads/2026/04/townelake2.jpg';
	const destination = '/uploads/2026/04/townelake2.jpg';
	for (const method of ['GET', 'HEAD']) {
		const response = await fetch(new URL(source, base), { method, redirect: 'manual' });
		assert.equal(response.status, 301, `${method} ${source}`);
		assert.equal(response.headers.get('location'), destination);
		const target = await fetch(new URL(response.headers.get('location'), base), { method, redirect: 'manual' });
		assert.equal(target.status, 200, 'Replacement asset must be served without another redirect');
		assert.equal(target.headers.get('location'), null);
		assert.match(target.headers.get('content-type') ?? '', /^image\/jpeg\b/i);
	}
});

test('unrelated paths and unresolved property URLs keep their 404 responses', async () => {
	const paths = [
		'/agents/', '/agents/other-agent/', '/agents/amy-lippincott/extra/',
		'/agents/amy-lippincott-other/', '/contact/extra/', '/contact-other/',
		'/property-search/search-form/',
		'/property-search/detail/70/50208824/4710-oakbluff-court-fulshear-tx-77441/',
		'/property-search/detail/70/50914160/5623-sycamore-creek-drive-houston-tx-77345/',
		'/unknown-historical-url/',
	];
	for (const path of paths) {
		const response = await fetch(new URL(path + '?utm_source=audit', base), { redirect: 'manual' });
		assert.equal(response.status, 404, path);
		assert.equal(response.headers.get('location'), null, path);
	}
});

test('existing destinations and contact thank-you route remain live', async () => {
	for (const path of ['/about/amy-lippincott-2/', '/contact-us/', '/contact-us/thank-you/', '/buy/', '/sell/']) {
		const response = await fetch(new URL(path, base), { redirect: 'manual' });
		assert.equal(response.status, 200, path);
		assert.equal(response.headers.get('location'), null, path);
	}
});
