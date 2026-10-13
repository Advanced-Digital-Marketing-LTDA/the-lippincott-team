import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvedMappings, buildCases, findCanonical, findHeading, probeRoute } from './audit/verify-historical-url-recovery.mjs';

const base = 'https://thelippincottteam.com';
const source = `${base}/contact/?utm_source=lip21_audit&tag=a&tag=b&empty=`;
const target = `${base}/contact-us/?utm_source=lip21_audit&tag=a&tag=b&empty=`;
const html = '<html><head><link href="https://thelippincottteam.com/contact-us/" rel="canonical"></head><body><h1>Tell us about your move</h1></body></html>';

function reply(status, location, body = html) {
  return new Response(body && status === 200 ? body : null, {
    status,
    headers: location ? { location } : { 'content-type': 'text/html' },
  });
}
function mock(routes) {
  return async url => routes.get(url) || reply(404, null, 'missing');
}

test('probes only two existing approved URL mappings and both source hosts', () => {
  assert.equal(approvedMappings.length, 2);
  assert.equal(buildCases().length, 16);
  assert.equal(buildCases({ allHosts: true }).length, 32);
  assert.ok(!buildCases().some(x => x.source.includes('property-search')));
});

test('accepts exactly one permanent redirect to a self-canonical 200 page with identical query', async () => {
  const result = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, '/contact-us/?utm_source=lip21_audit&tag=a&tag=b&empty=')],
    [target, reply(200)],
  ])) });
  assert.equal(result.passed, true);
  assert.equal(result.hops.length, 1);
  assert.equal(result.canonical, `${base}/contact-us/`);
});

test('rejects temporary host hops even when the final page is correct', async () => {
  const www = source.replace(base, 'https://www.thelippincottteam.com');
  const result = await probeRoute(www, '/contact-us/', { fetchImpl: mock(new Map([
    [www, reply(302, source)],
    [source, reply(301, target)],
    [target, reply(200)],
  ])) });
  assert.equal(result.passed, false);
  assert.match(result.error, /exactly one HTTP 301/);
});

test('rejects dropped query parameters and unrelated redirects', async () => {
  const dropped = `${base}/contact-us/`;
  const lost = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, dropped)], [dropped, reply(200)],
  ])) });
  assert.equal(lost.passed, false);
  assert.match(lost.error, /Final URL/);
  const offsite = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, 'https://other.example/')],
  ])) });
  assert.equal(offsite.passed, false);
  assert.match(offsite.error, /Unexpected destination host/);
});

test('rejects loops, missing self-canonical and soft-404 bodies', async () => {
  const loop = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, source)],
  ])) });
  assert.match(loop.error, /loop/i);

  const noCanonical = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, target)],
    [target, reply(200, null, '<html><h1>Contact</h1></html>')],
  ])) });
  assert.match(noCanonical.error, /Canonical mismatch/);

  const noHeading = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, target)],
    [target, reply(200, null, '<link rel="canonical" href="https://thelippincottteam.com/contact-us/">')],
  ])) });
  assert.match(noHeading.error, /no H1/);
});

test('parses link rel canonical regardless of attribute order and leaves other links alone', () => {
  assert.equal(findCanonical(`<link rel='alternate' href='wrong'><link href='${base}/contact-us/' rel='Canonical'>`), `${base}/contact-us/`);
});

test('network failures are reported as unverified, never as a passing result', async () => {
  const result = await probeRoute(source, '/contact-us/', {
    fetchImpl: async () => { throw new Error('DNS unavailable'); },
  });
  assert.equal(result.passed, false);
  assert.match(result.error, /DNS unavailable/);
});

test('body read failures produce an explicit failed result rather than aborting the run', async () => {
  const result = await probeRoute(source, '/contact-us/', { fetchImpl: async url => {
    if (url === source) return reply(301, target);
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      async text() { throw new Error('stream reset'); },
    };
  }});
  assert.equal(result.passed, false);
  assert.equal(result.final.status, 200);
  assert.match(result.error, /HTTP body unavailable: stream reset/);
  assert.equal(result.hops.length, 1);
});

test('rejects a branded soft 404 that returns HTTP 200, matching canonical and any H1', async () => {
  const branded404 = '<html><head><link rel="canonical" href="https://thelippincottteam.com/contact-us/"></head><body><h1>Page not found</h1></body></html>';
  const result = await probeRoute(source, '/contact-us/', { fetchImpl: mock(new Map([
    [source, reply(301, target)],
    [target, reply(200, null, branded404)],
  ])) });
  assert.equal(result.passed, false);
  assert.match(result.error, /H1 does not identify expected page/);
});

test('recognizes nested heading spans and requires a known approved destination', async () => {
  const split = '<h1>Tell us about <span>your move.</span></h1>';
  assert.equal(findHeading(split), 'Tell us about your move.');
  const unapproved = await probeRoute(source, '/unapproved/', {
    fetchImpl: async () => { throw new Error('should not request'); },
  });
  assert.equal(unapproved.passed, false);
  assert.match(unapproved.error, /not approved/);
});
