import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { legacyRedirects } from '../src/lib/legacy-redirect-data.mjs';

const redirects = [
	{ source: '/agents/amy-lippincott/', destination: '/about/amy-lippincott-2/', file: 'agents/amy-lippincott.ts' },
	{ source: '/contact/', destination: '/contact-us/', file: 'contact.ts' },
	{ source: '/seller-net-proceeds-calculator/', destination: '/sell/seller-net-proceeds-calculator/', file: 'seller-net-proceeds-calculator.ts' },
	...legacyRedirects.map(([source, destination]) => ({
		source,
		destination,
		file: `${source.slice(1).replace(/\/$/, '')}.ts`,
	})),
];
const netlifyRules = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
	.split('\n')
	.filter((line) => line.trim() && !line.trim().startsWith('#'))
	.map((line) => line.trim().split(/\s+/));

async function loadRoute(file) {
	const routeURL = new URL(`../src/pages/${file}`, import.meta.url);
	assert.ok(existsSync(routeURL), `Missing exact redirect endpoint: ${file}`);
	return import(routeURL.href);
}

function requestRedirect(route, source, { method = 'GET', suffix = '' } = {}) {
	const request = new Request(`https://thelippincottteam.com${source}${suffix}`, { method });
	return route.ALL({
		request,
		url: new URL(request.url),
		redirect: (destination, status) => new Response(null, { status, headers: { location: destination } }),
	});
}

for (const { source, destination, file } of redirects) {
	test(`${source} permanently redirects GET and HEAD to its destination`, async () => {
		const route = await loadRoute(file);
		assert.equal(route.prerender, false, 'Must emit an HTTP redirect rather than static meta refresh');
		for (const method of ['GET', 'HEAD']) {
			const response = await requestRedirect(route, source, { method });
			assert.equal(response.status, 301);
			assert.equal(response.headers.get('location'), destination);
			assert.equal(await response.text(), '');
		}
	});

	test(`${source} preserves raw query encoding, repeated keys, and empty values`, async () => {
		const route = await loadRoute(file);
		const suffix = '?utm_source=Google%20Search&tag=a&tag=b&empty=&return=%2Fbuy%2F&name=A+B';
		const response = await requestRedirect(route, source, { suffix });
		assert.equal(response.headers.get('location'), destination + suffix);
	});

	test(`${source} keeps the destination fixed when query values contain external URLs`, async () => {
		const route = await loadRoute(file);
		const suffix = '?next=https%3A%2F%2Fexample.org%2F&redirect=%2F%2Fexample.org';
		const response = await requestRedirect(route, source, { suffix });
		assert.equal(response.headers.get('location'), destination + suffix);
	});

	test(`${source} leaves fragment inheritance to the browser`, async () => {
		const route = await loadRoute(file);
		const response = await requestRedirect(route, source, { suffix: '?utm_source=audit#contact-ledger' });
		assert.equal(response.headers.get('location'), `${destination}?utm_source=audit`);
	});

	test(`${source} has a matching exact permanent Netlify rule`, () => {
		const rules = netlifyRules.filter(([from]) => from === source);
		assert.deepEqual(rules, [[source, destination, '301']]);
	});
}

test('/wp-content/uploads/2026/04/townelake2.jpg has a matching exact permanent Netlify rule', () => {
	const source = '/wp-content/uploads/2026/04/townelake2.jpg';
	const destination = '/uploads/2026/04/townelake2.jpg';
	const rules = netlifyRules.filter(([from]) => from === source);
	assert.deepEqual(rules, [[source, destination, '301']]);
});
