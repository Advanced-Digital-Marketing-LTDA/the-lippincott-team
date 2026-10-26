import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Tina/Vite resolves extensionless schema imports; mirror that for Node's type stripper.
registerHooks({
	resolve(specifier, context, nextResolve) {
		try { return nextResolve(specifier, context); }
		catch (error) {
			if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
				return nextResolve(`${specifier}.ts`, context);
			}
			throw error;
		}
	},
});

const { labelLinkFields } = await import('../tina/schema-fields.ts');
const shared = await import('../src/components/standalone/shared-fields.template.ts');
const { homeTemplate } = await import('../src/components/standalone/home.template.ts');
const { reviewsTemplate, blogIndexTemplate } = await import('../src/components/standalone/reviews.template.ts');
const { contactFormBlockSchema } = await import('../src/components/blocks/contactForm.template.ts');
const { GlobalConfigCollection } = await import('../tina/collections/global-config.ts');

const itemSamples = [
	{},
	{ label: '', title: '', name: '', slabel: '', num: '', bold: '', tag: '', question: '', src: '' },
	{ label: 'Label', title: 'Title', name: 'Name', slabel: 'Stat label', num: 'Number', bold: 'Bold', tag: 'Tag', question: 'Question', src: 'Source' },
];

// Object-key order is not schema behavior; array/field order and every value are.
// Include callbacks' results because JSON alone would silently drop UI behavior.
function normalize(value) {
	if (typeof value === 'function') return { functionResults: itemSamples.map((item) => normalize(value(item))) };
	if (Array.isArray(value)) return value.map(normalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
	}
	return value;
}

// Captured before the schema-only refactor. A changed field, description, flag,
// option, list order or callback result must be deliberately reviewed, not blessed.
const snapshots = {
	homeTemplate: '1665386842b09cdcde3b739b795e3234b67b58c35add5d75df1ac2b34d8b7b05',
	reviewsTemplate: '7c6819a99d1908ee63929c8c7fdfdae6c4a96fc99f0da3caaba7798a3f1eaf85',
	blogIndexTemplate: '1794072b76a185a89b51dc25583c45ae23413f82a2263facc031c87bcf47dd85',
	buy: '2b06928b7570530e3c0f804ead4fe647964ba61b081bba56f1b8f13c239692b9',
	sell: 'bc3b904e5bb8ed3a2971bed64409fb54d1a6b926f58ee991a4fb2a83cd60a395',
	utility: '37d3b0c1527a81583e1b667f448d6c9dd5b6269c497bc15efc068959efd10abd',
	contactFormBlockSchema: 'ee46953e614c7c1e4afe1009668549ef3b0bbc4debc7c743643b0daaad1a88e5',
	GlobalConfigCollection: '14e5c002352d2378fc5debd3392900bae151866082f2af3a2fa1fe38952d5ea1',
};
const schemas = {
	homeTemplate, reviewsTemplate, blogIndexTemplate,
	buy: shared.buySellFields('buyers'), sell: shared.buySellFields('sellers'),
	utility: shared.utilityFields(), contactFormBlockSchema, GlobalConfigCollection,
};

for (const [name, schema] of Object.entries(schemas)) {
	test(`${name} preserves the pre-refactor schema and UI labels`, () => {
		const hash = createHash('sha256').update(JSON.stringify(normalize(schema))).digest('hex');
		assert.equal(hash, snapshots[name]);
	});
}

function assertFreshObjects(values) {
	const seen = new Set();
	function visit(value) {
		if (!value || typeof value !== 'object') return;
		assert.ok(!seen.has(value), 'schema arrays, fields and UI objects must not share mutable references');
		seen.add(value);
		for (const child of Object.values(value)) visit(child);
	}
	for (const value of values) visit(value);
}

test('FAQ and CTA factories create isolated nested fields on every call', () => {
	assert.equal(typeof shared.faqField, 'function', 'the common FAQ schema must have one factory');
	assert.equal(typeof shared.finalCtaField, 'function', 'the common CTA schema must have one factory');
	assertFreshObjects([shared.faqField(), shared.faqField(), shared.finalCtaField(), shared.finalCtaField()]);
});

test('every exported page schema has its own mutable nested objects', () => {
	assertFreshObjects(Object.values(schemas));
});

test('label/link fields retain per-button URL guidance without sharing fields', () => {
	const fields = labelLinkFields(false, 'e.g. /contact-us/');
	assert.deepEqual(fields, [
		{ type: 'string', name: 'label', label: 'Label' },
		{ type: 'string', name: 'link', label: 'Link', description: 'e.g. /contact-us/' },
	]);
	assertFreshObjects([fields, labelLinkFields(false, 'e.g. /contact-us/')]);
});
