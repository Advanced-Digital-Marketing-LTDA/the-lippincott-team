import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const islands = readFileSync(new URL('../src/lib/islands.ts', import.meta.url), 'utf8');

test('page Tina island wrapper does not create a nested main landmark', () => {
	const pageEntry = islands.match(/\bpage:\s*\{([\s\S]*?)\n\t\},\n\tblog:/)?.[1];
	assert.ok(pageEntry, 'page island registry entry must exist');
	assert.match(pageEntry, /wrapper:\s*\{\s*tag:\s*'div'\s*\}/);
	assert.doesNotMatch(pageEntry, /wrapper:\s*\{\s*tag:\s*'main'\s*\}/);
});
