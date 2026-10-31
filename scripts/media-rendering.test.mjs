import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { sanitizeHref, sanitizeImageSrc } from '@tinacms/astro/sanitize';
import { parseCdnConfig, resolveMediaUrl } from './cdn-config.mjs';
import { isExternal, safeHref } from '../src/lib/url.ts';

const site = 'https://thelippincottteam.com';
const path = '/uploads/2026/Photo%20One.webp?version=2#view';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const cases = {
  'components/standalone/HomeBody.astro': ['hero.video', 'team.video', 'team.videoPoster', 'testi.video', 'testi.videoPoster', 'card.image'],
  'components/standalone/BuySellBody.astro': ['hero.image'],
  'components/standalone/BlogIndexBody.astro': ['post.heroImage'],
  'components/islands/BlogBody.astro': ['author.photo', 'data.heroImage', 'post.heroImage'],
  'components/islands/TeamBody.astro': ['data.photo', 'data.marketLogo'],
  'components/islands/CommunityBody.astro': ['data.heroImage'],
  'components/ui/Avatar.astro': ['src'],
  'components/blocks/Hero.astro': ['data.backgroundImage', 'data.backgroundVideo', 'data.image.src'],
  'components/blocks/GuideHero.astro': ['stackedImage', 'data.backgroundImage'],
  'components/blocks/Video.astro': ['data.poster', 's.src'],
  'components/blocks/TestimonialShowcase.astro': ['data.poster', 'data.videoUrl'],
  'components/blocks/TeamGrid.astro': ['lead.photo', 'member.photo'],
  'components/blocks/TeamBanner.astro': ['data.backgroundImage'],
  'components/blocks/TrustStrip.astro': ['item.ratingImage', 'item.image', 'item.link'],
  'components/blocks/Split.astro': ['data.image.src'],
  'components/blocks/PhotoCardGrid.astro': ['card.image'],
  'components/blocks/CommunityGrid.astro': ['node.heroImage'],
  'pages/index.astro': ['data.hero.poster'],
};
for (const mode of ['full-site', 'media-only']) {
  const config = parseCdnConfig({ PUBLIC_CDN_MODE: mode, PUBLIC_MEDIA_URL: 'https://media.example.invalid' });
  const mediaUrl = value => resolveMediaUrl(value, config, site);
  for (const [file, fields] of Object.entries(cases)) {
    test(`${mode}: ${file} resolves actual media attribute expressions`, () => {
      const source = read(file);
      for (const field of fields) {
        const expressions = [...source.matchAll(/(?:src|poster|href)=\{([^}]+)\}/g)].map(m => m[1]).filter(e => new RegExp(`\\b${field.replaceAll('.', '\\.')}\\b`).test(e));
        assert.ok(expressions.length, `${file}: missing ${field}`);
        const scope = { mediaUrl, safeHref, mediaSite: site, src: path, stackedImage: path };
        for (const name of ['data', 'hero', 'team', 'testi', 'card', 'post', 'author', 'lead', 'member', 'item', 'node', 's']) scope[name] = { video: path, videoPoster: path, heroImage: path, photo: path, marketLogo: path, backgroundImage: path, backgroundVideo: path, poster: path, videoUrl: path, ratingImage: path, src: path, image: { src: path }, hero: { poster: path } };
        scope.card.image = scope.item.image = path;
        scope.hero.image = path;
        scope.item.link = path;
        for (const expr of expressions) assert.equal(runInNewContext(expr, scope), mediaUrl(path), `${file}: ${expr}`);
      }
    });
  }
  test(`${mode}: trust-strip links retain navigation and reject unsafe URLs`, () => {
    const expression = read('components/blocks/TrustStrip.astro').match(/href=\{([^}]+)\}/)[1];
    for (const link of ['/about/', '#reviews', 'https://other.test/uploads/a.pdf', 'javascript:alert(1)', '//evil.test/a']) {
      assert.equal(runInNewContext(expression, { item: { link }, mediaUrl, safeHref, mediaSite: site }), mediaUrl(safeHref(link)));
    }
  });
  test(`${mode}: rich-text overrides retain Tina sanitization and resolve owned URLs`, () => {
    for (const [file, attribute, sanitizer] of [['MediaImage', 'src', sanitizeImageSrc], ['MediaLink', 'href', sanitizeHref], ['AboutIntroLink', 'href', sanitizeHref]]) {
      let source;
      try { source = read(`components/mdx/${file}.astro`); } catch { assert.fail(`${file} override missing`); }
      const frontmatter = stripTypeScriptTypes(source.split('---')[1].replace(/^import .+;$/gm, ''));
      const expression = source.match(new RegExp(`${attribute}=\\{([^}]+)\\}`))[1];
      for (const url of [path, 'https://assets.tina.io/uploads/preview.png', 'tel:+17134941818', 'javascript:alert(1)', '//evil.test/a', 'data:image/svg+xml,evil']) {
        const actual = runInNewContext(`${frontmatter}\n${expression}`, { Astro: { props: { url }, site: new URL(site), url: new URL(site) }, mediaUrl, safeHref, isExternal, sanitizeHref, sanitizeImageSrc });
        const expectedSanitized = file === 'AboutIntroLink' && /^tel:/i.test(url) ? safeHref(url) : sanitizer(url);
        assert.equal(actual, mediaUrl(expectedSanitized));
      }
    }
  });
}
