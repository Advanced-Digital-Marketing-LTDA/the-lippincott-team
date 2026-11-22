import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { setPageLoader } from './test-fixtures/contact-data.mjs';

const routeUrl = new URL('../src/pages/api/contact.ts', import.meta.url).href;
const fixtureUrl = new URL('./test-fixtures/contact-data.mjs', import.meta.url).href;
// Node's TypeScript support strips types but does not resolve Astro's
// extensionless imports. Keep the override limited to this route's imports.
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (context.parentURL?.startsWith(routeUrl)) {
			if (specifier === '../../lib/data') return nextResolve(fixtureUrl, context);
			if (specifier.startsWith('../../lib/')) return nextResolve(`${specifier}.ts`, context);
		}
		return nextResolve(specifier, context);
	},
});

let routeId = 0;
const contactBlock = (interestOptions) => ({ __typename: 'PageBlocksContactForm', interestOptions });
const customOption = { label: 'Tour a new build', leadType: '1' };
const customValue = '1|Tour a new build';

async function setup(t, loader) {
	setPageLoader(loader);
	const originalKey = process.env.SIERRA_API_KEY;
	process.env.SIERRA_API_KEY = 'test-only-key';
	t.after(() => {
		if (originalKey === undefined) delete process.env.SIERRA_API_KEY;
		else process.env.SIERRA_API_KEY = originalKey;
	});
	const leads = [];
	t.mock.method(globalThis, 'fetch', async (_input, init) => {
		leads.push(JSON.parse(init.body));
		return Response.json({ success: true, data: { leadId: 123 } });
	});
	const { POST } = await import(`${routeUrl}?test=${++routeId}`);
	let requestId = 0;
	return {
		leads,
		submit: (interest, extra = {}) => POST({
			clientAddress: `192.0.2.${++requestId}`,
			request: new Request('https://thelippincottteam.com/api/contact', {
				method: 'POST',
				body: new URLSearchParams({
					'form-name': 'contact', name: 'Test Person', email: 'test@example.com', interest, ...extra,
				}),
			}),
		}),
	};
}

test('accepts default choices from an empty form alongside a custom form', async (t) => {
	const { submit, leads } = await setup(t, async () => [
		{ blocks: [contactBlock([customOption])] },
		{ blocks: [contactBlock([])] },
	]);
	assert.equal((await submit(customValue)).status, 303);
	assert.equal((await submit('2|Sell my home')).status, 303);
	assert.equal(leads[1].leadType, 2);
	assert.match(leads[1].note, /Interest: Sell my home/);
});

test('uses defaults for a form with only incomplete options', async (t) => {
	const { submit } = await setup(t, async () => [{ blocks: [
		contactBlock([customOption]),
		contactBlock([null, { label: '   ', leadType: '2' }, { label: 'Missing type' }]),
	] }]);
	assert.equal((await submit('1|Buy a home')).status, 303);
});

test('rejects unconfigured typed choices when every form has custom choices', async (t) => {
	const { submit, leads } = await setup(t, async () => [{ blocks: [contactBlock([customOption])] }]);
	assert.equal((await submit('2|Sell my home')).status, 400);
	assert.equal((await submit('2|Tour a new build')).status, 400);
	assert.equal(leads.length, 0);
});

test('serves the last good options during a failed refresh and retries afterward', async (t) => {
	let now = 1_000;
	let loads = 0;
	t.mock.method(Date, 'now', () => now);
	const { submit, leads } = await setup(t, async () => {
		loads += 1;
		if (loads === 2) throw new Error('Temporary Tina outage');
		return [{ blocks: [contactBlock([{ label: loads === 1 ? customOption.label : 'Move to Cypress', leadType: '1' }])] }];
	});
	assert.equal((await submit(customValue)).status, 303);
	now += 5 * 60 * 1000;
	assert.equal((await submit(customValue)).status, 303);
	assert.equal(leads.length, 2);
	assert.equal((await submit('1|Move to Cypress')).status, 303);
	assert.equal(loads, 3);
	assert.equal((await submit(customValue)).status, 400);
});

test('uses defaults on a cold lookup failure without caching that failure', async (t) => {
	let loads = 0;
	const { submit } = await setup(t, async () => {
		if (++loads === 1) throw new Error('Temporary Tina outage');
		return [{ blocks: [contactBlock([customOption])] }];
	});
	assert.equal((await submit('2|Sell my home')).status, 303);
	assert.equal((await submit(customValue)).status, 303);
	assert.equal(loads, 2);
});

test('shares an in-flight lookup and caches a successful result until expiry', async (t) => {
	let loads = 0;
	let resolvePages;
	const { submit } = await setup(t, () => {
		loads += 1;
		return new Promise((resolve) => { resolvePages = resolve; });
	});
	const first = submit(customValue);
	const second = submit(customValue);
	// Wait for the streamed request bodies to reach the CMS lookup boundary.
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(loads, 1);
	resolvePages([{ blocks: [contactBlock([customOption])] }]);
	assert.deepEqual((await Promise.all([first, second])).map((r) => r.status), [303, 303]);
	assert.equal((await submit(customValue)).status, 303);
	assert.equal(loads, 1);
});

test('enforces reCAPTCHA v3 only when the secret is set', async (t) => {
	const { submit, leads } = await setup(t, async () => []);
	assert.equal((await submit('2|Sell my home')).status, 303);
	process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
	t.after(() => { delete process.env.RECAPTCHA_SECRET_KEY; delete process.env.PUBLIC_RECAPTCHA_SITE_KEY; });
	// Secret without a site key: reCAPTCHA is skipped so a half-configured deploy keeps leads flowing.
	t.mock.method(console, 'error', () => {});
	assert.equal((await submit('2|Sell my home')).status, 303);
	process.env.PUBLIC_RECAPTCHA_SITE_KEY = 'test-site-key';
	let verdict;
	const leadFetch = globalThis.fetch;
	t.mock.method(globalThis, 'fetch', (input, init) =>
		String(input).includes('recaptcha/api/siteverify') ? Response.json(verdict) : leadFetch(input, init));
	const token = { 'g-recaptcha-response': 'tok' };
	assert.equal((await submit('2|Sell my home')).status, 400);
	for (verdict of [{ success: false }, { success: true, action: 'contact', score: 0.1 }, { success: true, action: 'other', score: 0.9 }]) {
		assert.equal((await submit('2|Sell my home', token)).status, 400);
	}
	assert.equal(leads.length, 2);
	verdict = { success: true, action: 'contact', score: 0.9 };
	assert.equal((await submit('2|Sell my home', token)).status, 303);
	assert.equal(leads.length, 3);
});
