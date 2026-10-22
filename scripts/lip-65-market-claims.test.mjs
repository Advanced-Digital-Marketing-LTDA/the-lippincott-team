import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const content = Object.fromEntries(await Promise.all([
  ['home', 'src/content/standalone/home.mdx'],
  ['buy', 'src/content/standalone/buy.mdx'],
  ['sell', 'src/content/standalone/sell.mdx'],
  ['regional', 'src/content/page/northwest-houston-real-estate.mdx'],
  ['cypress', 'src/content/community/northwest-houston-real-estate/cypress-tx-real-estate.mdx'],
].map(async ([key, path]) => [key, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])));

test('buy and sell pages no longer use unverified sale-to-list or statewide seller price-cut claims', () => {
  for (const page of [content.buy, content.sell]) {
    assert.doesNotMatch(page, /95\s*[–-]\s*98\s*%|95 to 98%|homes?[^\n]{0,60}closed at 95 to 98% of asking/i);
    assert.doesNotMatch(page, /\$12,500|3\.6% of (?:the )?(?:initial )?list/i);
    assert.doesNotMatch(page, /realtor\.com\/local\/market\/texas/);
    assert.match(page, /https:\/\/www\.har\.com\/content\/department\/mls\?m=09&y=2026/);
    assert.doesNotMatch(page, /Sellers outnumber buyers for the first time in years|pending sales declined 3\.5%|28 to 69 in August 2026|three-to-five-month timeline/i);
  }
  assert.doesNotMatch(content.sell, /28 to 31 in August|balanced market/i);
});

test('homepage omits pending-sales scope ambiguity and qualifies the Cypress active-price snapshot', () => {
  assert.doesNotMatch(content.home, /-3\.5%|pending sales, year over year|inside the balanced range/i);
  assert.match(content.home, /single-family median sale price, 54 average days on market, and 5\.3 months of single-family supply/i);
  assert.match(content.home, /displayed property filter and exact city boundary have not been independently verified/i);
  assert.doesNotMatch(content.home, /Cypress's single-family median active listing price/i);
});

test('regional page limits city values to qualified HAR snapshots and uses verified metro context', () => {
  assert.match(content.regional, /not independently verified.*property-type filters or exact city boundaries/i);
  assert.match(content.regional, /not a like-for-like single-family comparison/i);
  assert.match(content.regional, /HAR's August 2026 Greater Houston report lists a \$330,000 single-family median sale price, 54 average days on market, and 5\.3 months/i);
  assert.doesNotMatch(content.regional, /\$120,075|active inventory is up year over year in all six cities|single-family active-listing medians span/i);
  assert.doesNotMatch(content.regional, /\$329,925[^\n]{0,100}\$334,995/);
});

test('Cypress removes incompatible ratio and ladder figures while retaining browse destinations and FAQs', () => {
  assert.doesNotMatch(content.cypress, /homes selling at 98% of asking|sale-to-list.*Realtor\.com|Redfin[^\n]{0,120}\$357K|\$357,000/i);
  assert.doesNotMatch(content.cypress, /_template: priceLadder/);
  for (const unsupported of ['$740,000', '$680,000', '$675,000', '$525,000', '$500,000', '$446,950', '$399,950', '$376,500', '$324,990']) {
    assert.ok(!content.cypress.includes(unsupported), `Unexpected unverified Cypress neighborhood amount: ${unsupported}`);
  }
  assert.match(content.cypress, /Towne Lake\]\(\/northwest-houston-real-estate\/cypress-tx-real-estate\/towne-lake-real-estate\/\)/);
  assert.match(content.cypress, /Blackhorse Ranch\]\(https:\/\/www\.thelippincottteamlistings\.com\/property-search\/results\//);
  assert.match(content.cypress, /_template: faq/);
  assert.match(content.cypress, /displayed property-type filter/i);
  assert.match(content.cypress, /exact city boundary have not been independently verified/i);
  assert.match(content.cypress, /https:\/\/www\.har\.com\/cypress\/realestate\/pricetrends/);
  assert.match(content.cypress, /listingUrl: "https:\/\/www\.thelippincottteamlistings\.com\/property-search\/results\//);
  assert.doesNotMatch(content.cypress, /^\s*(?:author|bio|keyTakeaways):/im);
});

test('shared data tables retain accessible captions, scoped headers, and left-aligned row labels', async () => {
  const table = await readFile(new URL('../src/components/blocks/DataTable.astro', import.meta.url), 'utf8');
  assert.match(table, /<caption class="sr-only">\{tableCaption\}<\/caption>/);
  assert.match(table, /<th scope="col"/);
  assert.match(table, /<th scope="row"[^\n]*class=\{`\$\{cellClass\} text-left`\}/);
});
