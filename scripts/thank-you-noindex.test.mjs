import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { includeInSitemap } from '../src/lib/sitemap-filter.mjs';

// LIP-91: the consultation confirmation is a functional page, so it carries
// noindex and stays out of the sitemap, while every other page stays indexable.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('thank-you page asks the layout for noindex', () => {
	const source = read('src/pages/contact-us/thank-you.astro');
	assert.match(source, /<Base\b[^>]*\bnoindex\b[^>]*>/);
});

test('no other page opts out of indexing', () => {
	const pagesDir = new URL('../src/pages/', import.meta.url).pathname;
	const walk = (dir) => readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : full.endsWith('.astro') ? [full] : [];
	});
	const optedOut = walk(pagesDir)
		.filter((file) => /<Base\b[^>]*\bnoindex\b/.test(readFileSync(file, 'utf8')))
		.map((file) => file.slice(pagesDir.length));
	assert.deepEqual(optedOut, ['contact-us/thank-you.astro']);
});

test('layout forwards noindex to the head, which emits robots noindex only when set', () => {
	assert.match(read('src/layouts/Base.astro'), /<BaseHead\b[^>]*\bnoindex=\{noindex\}/);
	const head = read('src/components/BaseHead.astro');
	assert.match(head, /noindex = false/);
	assert.match(head, /\{noindex && <meta name="robots" content="noindex" \/>\}/);
});

test('sitemap filter drops only the thank-you path', () => {
	assert.match(read('astro.config.mjs'), /sitemap\(\{ filter: includeInSitemap \}\)/);
	assert.equal(includeInSitemap('https://thelippincottteam.com/contact-us/thank-you/'), false);
	assert.equal(includeInSitemap('https://thelippincottteam.com/contact-us/'), true);
	assert.equal(includeInSitemap('https://thelippincottteam.com/'), true);
	assert.equal(includeInSitemap('https://thelippincottteam.com/blog/how-real-estate-agents-price-homes/'), true);
});
