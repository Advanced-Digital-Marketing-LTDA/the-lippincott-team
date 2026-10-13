// Read-only public HTTP acceptance check for LIP-21.
// Run from a network-enabled environment after an authorized release:
//   node scripts/audit/verify-historical-url-recovery.mjs
//   node scripts/audit/verify-historical-url-recovery.mjs --all-hosts
// No deployment, settings changes, form submissions, or outreach.
import { pathToFileURL } from 'node:url';

const canonicalOrigin = 'https://thelippincottteam.com';
const allowedHosts = new Set(['thelippincottteam.com', 'www.thelippincottteam.com']);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const sampleQuery = '?utm_source=lip21_audit&tag=a&tag=b&empty=';

export const approvedMappings = Object.freeze([
  { oldPath: '/agents/amy-lippincott/', newPath: '/about/amy-lippincott-2/', label: 'Amy profile', expectedHeading: 'Amy Lippincott' },
  { oldPath: '/contact/', newPath: '/contact-us/', label: 'Contact', expectedHeading: 'Tell us about your move' },
]);

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? match[1] ?? match[2] : null;
}

export function findCanonical(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (htmlAttribute(tag, 'rel')?.toLowerCase().split(/\s+/).includes('canonical')) {
      return htmlAttribute(tag, 'href');
    }
  }
  return null;
}

export function findHeading(html) {
  const opening = /<h1\b[^>]*>/i.exec(html);
  if (!opening) return null;
  const start = opening.index + opening[0].length;
  const closingPattern = /<\/h1\s*>/gi;
  closingPattern.lastIndex = start;
  const closing = closingPattern.exec(html);
  if (!closing) return null;
  return html.slice(start, closing.index).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fetchPage(current, method, fetchImpl) {
  return fetchImpl(current, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(12000),
    headers: { accept: 'text/html' },
  });
}

function redirectLocation(response, current) {
  const location = response.headers.get('location');
  if (!location) return { error: `HTTP ${response.status} missing Location` };
  try {
    return { next: new URL(location, current).href };
  } catch {
    return { error: `Invalid Location: ${location}` };
  }
}

async function validateDocument(result, response, expectedPath, expectedHeading) {
  let html;
  try {
    html = await response.text();
  } catch (error) {
    result.error = `HTTP body unavailable: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  const canonical = findCanonical(html);
  result.canonical = canonical;
  const expectedCanonical = new URL(expectedPath, canonicalOrigin).href;
  if (!canonical || canonical !== expectedCanonical) {
    result.error = `Canonical mismatch: ${canonical ?? 'missing'}; expected ${expectedCanonical}`;
    return;
  }
  const heading = findHeading(html);
  if (!heading) {
    result.error = 'Destination has no H1 (possible empty/soft-404 response)';
  } else if (!heading.toLowerCase().includes(expectedHeading.toLowerCase())) {
    result.error = `Destination H1 does not identify expected page: ${heading}`;
  }
}

async function validateDestination(result, response, current, expectedPath, expectedHeading, method) {
  result.final = { url: current, status: response.status };
  if (result.hops.length !== 1 || result.hops[0].status !== 301) {
    result.error = `Expected exactly one HTTP 301; received ${result.hops.map(h => h.status).join(' -> ') || 'no redirects'}`;
    return;
  }
  if (current !== result.expected) {
    result.error = 'Final URL does not match expected canonical destination/query';
    return;
  }
  if (response.status !== 200) {
    result.error = `Final page returned HTTP ${response.status}, not 200`;
    return;
  }
  if (method === 'GET') await validateDocument(result, response, expectedPath, expectedHeading);
  result.passed = !result.error;
}

// One probe, with a hard hop limit and no tolerance for a temporary redirect.
export async function probeRoute(sourceUrl, expectedPath, { method = 'GET', fetchImpl = fetch } = {}) {
  const expected = new URL(expectedPath + new URL(sourceUrl).search, canonicalOrigin).href;
  const result = { source: sourceUrl, expected, method, passed: false, hops: [], final: null, canonical: null, error: null };
  const expectedHeading = approvedMappings.find(mapping => mapping.newPath === expectedPath)?.expectedHeading;
  if (!expectedHeading) {
    result.error = `Destination not approved for a content-specific acceptance check: ${expectedPath}`;
    return result;
  }
  const visited = new Set();
  let current = sourceUrl;

  for (let i = 0; i <= 5; i++) {
    if (visited.has(current)) { result.error = 'Redirect loop'; return result; }
    visited.add(current);
    const url = new URL(current);
    if (!allowedHosts.has(url.hostname)) {
      result.error = `Unexpected destination host: ${url.hostname}`;
      return result;
    }

    let response;
    try {
      response = await fetchPage(current, method, fetchImpl);
    } catch (error) {
      result.error = `HTTP probe unavailable: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }

    if (redirectStatuses.has(response.status)) {
      const redirect = redirectLocation(response, current);
      if (redirect.error) { result.error = redirect.error; return result; }
      result.hops.push({ status: response.status, from: current, to: redirect.next });
      current = redirect.next;
      continue;
    }

    await validateDestination(result, response, current, expectedPath, expectedHeading, method);
    return result;
  }

  result.error = 'Exceeded five redirects';
  return result;
}

export function buildCases({ allHosts = false } = {}) {
  const hosts = ['https://thelippincottteam.com', 'https://www.thelippincottteam.com'];
  if (allHosts) hosts.push('http://thelippincottteam.com', 'http://www.thelippincottteam.com');
  const cases = [];
  for (const { oldPath, newPath, label } of approvedMappings) {
    for (const host of hosts) {
      for (const path of [oldPath, oldPath.replace(/\/$/, '')]) {
        for (const method of ['GET', 'HEAD']) {
          cases.push({ label, source: host + path + sampleQuery, destination: newPath, method });
        }
      }
    }
  }
  return cases;
}

async function main() {
  const allHosts = process.argv.includes('--all-hosts');
  const cases = buildCases({ allHosts });
  const results = [];
  for (const candidate of cases) {
    const result = await probeRoute(candidate.source, candidate.destination, { method: candidate.method });
    results.push({ label: candidate.label, ...result });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    canonicalOrigin,
    checked: results.length,
    passed: results.filter(x => x.passed).length,
    failed: results.filter(x => !x.passed).length,
    note: 'Checks approved Amy/contact source mappings only. Search-form, property-detail, seller-calculator, and host-layer decisions require separate approval and verification.',
    results,
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
