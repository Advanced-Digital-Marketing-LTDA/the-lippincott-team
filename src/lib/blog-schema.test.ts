import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBlogPostingJsonLd, resolveBlogAuthor, serializeJsonLd } from './blog-schema.js';

const site = 'https://thelippincottteam.com/';
const amy = { name: 'Amy Lippincott', _sys: { filename: 'amy-lippincott-2' } };
const ryan = { name: 'Ryan Zimmerman', _sys: { filename: 'ryan-zimmerman' } };

const fullPost = {
	title: 'How Real Estate Agents Price Homes',
	description: 'How agents use comps and a CMA.',
	pubDate: '2026-06-22T19:58:53.000Z',
	updatedDate: '2026-06-22T20:56:12.000Z',
	filename: 'how-real-estate-agents-price-homes',
	imageUrl: 'https://thelippincottteam.com/uploads/2026/06/pricing.webp',
	author: ryan,
	siteUrl: site,
	canonicalSite: site,
	publisherName: 'The Lippincott Team',
};

test('a post with complete metadata emits a full BlogPosting', () => {
	const ld = JSON.parse(serializeJsonLd(buildBlogPostingJsonLd(fullPost)));
	assert.deepEqual(ld, {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: 'How Real Estate Agents Price Homes',
		description: 'How agents use comps and a CMA.',
		datePublished: '2026-06-22T19:58:53.000Z',
		dateModified: '2026-06-22T20:56:12.000Z',
		image: 'https://thelippincottteam.com/uploads/2026/06/pricing.webp',
		mainEntityOfPage: 'https://thelippincottteam.com/blog/how-real-estate-agents-price-homes/',
		author: { '@type': 'Person', name: 'Ryan Zimmerman', url: 'https://thelippincottteam.com/about/ryan-zimmerman/' },
		publisher: { '@type': 'RealEstateAgent', '@id': 'https://thelippincottteam.com/#team', name: 'The Lippincott Team' },
	});
});

test('missing description, hero image and updatedDate are omitted, not emitted empty', () => {
	for (const blank of [null, undefined, '']) {
		const ld = buildBlogPostingJsonLd({ ...fullPost, description: blank, imageUrl: blank, updatedDate: blank });
		assert.equal('description' in ld, false);
		assert.equal('image' in ld, false);
		// dateModified falls back to the publish date.
		assert.equal(ld.dateModified, '2026-06-22T19:58:53.000Z');
		assert.doesNotThrow(() => JSON.parse(serializeJsonLd(ld)));
	}
});

test('author is the post author when set, else the default, and links to the about page', async () => {
	const loadAmy = async () => amy;
	const own = await resolveBlogAuthor(ryan, loadAmy);
	assert.equal(own, ryan);
	const fallback = await resolveBlogAuthor(undefined, loadAmy);
	assert.equal(fallback, amy);
	// The same resolved object feeds the visible byline and the JSON-LD.
	const ld = buildBlogPostingJsonLd({ ...fullPost, author: fallback });
	assert.deepEqual(ld.author, { '@type': 'Person', name: 'Amy Lippincott', url: 'https://thelippincottteam.com/about/amy-lippincott-2/' });
	// A failed default lookup yields no author rather than a broken node.
	const failed = await resolveBlogAuthor(null, () => Promise.reject(new Error('offline')));
	assert.equal(failed, null);
	assert.equal('author' in buildBlogPostingJsonLd({ ...fullPost, author: failed }), false);
});

test('publisher references the homepage RealEstateAgent #team node', () => {
	const { publisher } = buildBlogPostingJsonLd(fullPost);
	assert.equal(publisher['@type'], 'RealEstateAgent');
	assert.equal(publisher['@id'], 'https://thelippincottteam.com/#team');
});

test('serialization escapes HTML-sensitive content and round-trips it', () => {
	const title = 'Closing </script><script>alert(1)</script> & "quotes"';
	const out = serializeJsonLd(buildBlogPostingJsonLd({ ...fullPost, title }));
	assert.equal(out.includes('<'), false);
	assert.equal(out.toLowerCase().includes('</script'), false);
	assert.equal(JSON.parse(out).headline, title);
});
