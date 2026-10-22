import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { buildComparison, loadEvidence } from './lip-51-cohort-comparison.mjs';

const evidence = await loadEvidence();
const report = buildComparison(evidence);

test('uses settled inclusive 90-day and 28-day windows in the stated timezone', () => {
  assert.equal(evidence.source.timezone, 'America/Los_Angeles');
  assert.deepEqual(report.windows.prior90, { from: '2026-04-08', through: '2026-07-06', days: 90 });
  assert.deepEqual(report.windows.current90, { from: '2026-07-07', through: '2026-10-04', days: 90 });
  assert.deepEqual(report.windows.prior28, { from: '2026-08-10', through: '2026-09-06', days: 28 });
  assert.deepEqual(report.windows.current28, { from: '2026-09-07', through: '2026-10-04', days: 28 });
  assert.throws(() => buildComparison({ ...evidence, windows: { ...evidence.windows, current28: { ...evidence.windows.current28, days: 29 } } }), /declares 29 days but spans 28/);
});

test('reproduces 28-day property totals, CTR units, and incomplete coverage', () => {
  assert.deepEqual({
    clicks: report.propertyTotals.prior28.clicks,
    impressions: report.propertyTotals.prior28.impressions,
    ctrDecimal: Number(report.propertyTotals.prior28.ctrDecimal.toFixed(8)),
    ctrPercent: report.propertyTotals.prior28.ctrPercent,
    returnedDays: report.propertyTotals.prior28.coverage.returnedDays,
    missingDays: report.propertyTotals.prior28.coverage.missingDays,
  }, { clicks: 35, impressions: 3242, ctrDecimal: 0.01079581, ctrPercent: 1.0796, returnedDays: 13, missingDays: 15 });
  assert.deepEqual({
    clicks: report.propertyTotals.current28.clicks,
    impressions: report.propertyTotals.current28.impressions,
    ctrDecimal: Number(report.propertyTotals.current28.ctrDecimal.toFixed(8)),
    ctrPercent: report.propertyTotals.current28.ctrPercent,
    returnedDays: report.propertyTotals.current28.coverage.returnedDays,
    missingDays: report.propertyTotals.current28.coverage.missingDays,
  }, { clicks: 83, impressions: 7040, ctrDecimal: 0.01178977, ctrPercent: 1.179, returnedDays: 28, missingDays: 0 });
  assert.ok(report.propertyTotals.current28.averagePosition > 13.79 && report.propertyTotals.current28.averagePosition < 13.80);
  assert.throws(() => buildComparison({ ...evidence, propertyTotals: {
    ...evidence.propertyTotals,
    prior28: { ...evidence.propertyTotals.prior28, sourceCtrDecimal: 0.5 },
  } }), /source CTR does not match clicks divided by impressions/);
});

test('keeps property totals and listed page-family sums distinct', () => {
  assert.deepEqual(report.propertyTotals.prior90 && {
    clicks: report.propertyTotals.prior90.clicks,
    impressions: report.propertyTotals.prior90.impressions,
    ctrDecimal: Number(report.propertyTotals.prior90.ctrDecimal.toFixed(8)),
    ctrPercent: report.propertyTotals.prior90.ctrPercent,
  }, { clicks: 1220, impressions: 164937, ctrDecimal: 0.00739676, ctrPercent: 0.7397 });
  assert.deepEqual(report.propertyTotals.current90 && {
    clicks: report.propertyTotals.current90.clicks,
    impressions: report.propertyTotals.current90.impressions,
    ctrDecimal: Number(report.propertyTotals.current90.ctrDecimal.toFixed(8)),
    ctrPercent: report.propertyTotals.current90.ctrPercent,
  }, { clicks: 118, impressions: 10282, ctrDecimal: 0.01147637, ctrPercent: 1.1476 });
  assert.deepEqual(report.listedFamilySums.prior90, { urlRows: 23150, clicks: 1201 });
  assert.deepEqual(report.listedFamilySums.current90, { urlRows: 1241, clicks: 112 });
  assert.deepEqual(report.clickScopeCheck.prior90, {
    listedPageFamilyClickSum: 1201,
    propertyClicks: 1220,
    arithmeticDifference: 19,
    interpretation: 'Arithmetic check only. This is not an attributed residual or a reconciliation; keep page-family and property scopes separate.',
  });
  assert.deepEqual(report.clickScopeCheck.current90, {
    listedPageFamilyClickSum: 112,
    propertyClicks: 118,
    arithmeticDifference: 6,
    interpretation: 'Arithmetic check only. This is not an attributed residual or a reconciliation; keep page-family and property scopes separate.',
  });
});

test('compares only the bounded family metrics and does not infer family CTR', () => {
  const idx = report.pageFamilies.find(item => item.id === 'property-search');
  assert.deepEqual(idx, {
    id: 'property-search',
    label: '/property-search/ (IDX)',
    prior90: { urlRows: 23110, clicks: 840 },
    current90: { urlRows: 1186, clicks: 23 },
    rawDifference: { urlRows: -21924, clicks: -817 },
    impressions: 'not provided',
    ctr: 'not calculated',
  });
  const agents = report.pageFamilies.find(item => item.id === 'agents');
  assert.equal(agents.current90.clicks, 0);
  assert.equal(agents.impressions, 'not provided');
  assert.ok(report.pageFamilies.every(item => item.ctr === 'not calculated'));
});

test('keeps missing rows distinct from zero and records coverage limitations', () => {
  assert.deepEqual(report.dailyCoverage.prior90, { returnedDays: 86, windowDays: 90, missingDays: 4, fraction: 86 / 90 });
  assert.deepEqual(report.dailyCoverage.current90, { returnedDays: 41, windowDays: 90, missingDays: 49, fraction: 41 / 90 });
  assert.equal(report.missingDailyRows.from, '2026-07-03');
  assert.equal(report.missingDailyRows.through, '2026-08-24');
  assert.equal(report.firstResumedRow, '2026-08-25');
  assert.equal(report.settledCutoff, '2026-10-04');
  assert.equal(report.nextDayIncomplete, '2026-10-05');
  assert.ok(report.comparisonLimits.some(limit => /Do not treat missing rows as zero/.test(limit)));
});

test('preserves separate domain/property scope and excludes query conclusions', () => {
  assert.equal(report.otherPropertyScopes.separateDomainProperty, 'sc-domain:lippincottteam.com');
  assert.deepEqual({
    clicks: report.separateDomainPropertyTotals.prior28.clicks,
    impressions: report.separateDomainPropertyTotals.prior28.impressions,
    ctrPercent: report.separateDomainPropertyTotals.prior28.ctrPercent,
  }, { clicks: 97, impressions: 7048, ctrPercent: 1.3763 });
  assert.equal(report.separateDomainPropertyTotals.current90.coverage.returnedDays, 90);
  assert.equal(report.queryMetrics.state, 'not_included');
  assert.match(report.queryMetrics.disclosure, /Do not infer query-level movement/);
});

test('uses the dated 17-route sample and does not require exhaustive historical inventory', async () => {
  assert.equal(report.routeProbeSample.count, 17);
  assert.equal(report.routeProbeSample.observedAt, '2026-10-06');
  const audit = await readFile(new URL('../docs/audits/2026-10-13-lip-184-url-cohort-map.md', import.meta.url), 'utf8');
  const ids = [...audit.matchAll(/\| MIG-(\d{3}) \|/g)].map(match => Number(match[1]));
  assert.deepEqual(ids, Array.from({ length: 17 }, (_, index) => index + 1));
  assert.match(audit, /bounded sample/i);
  assert.match(audit, /not an exhaustive former-site export/i);
});

test('defers release comparison until LIP-189 is verified and does not revive canceled LIP-185', () => {
  assert.equal(report.postReleaseComparison.status, 'deferred');
  assert.equal(report.postReleaseComparison.releaseAnchorIssue, 'LIP-189');
  assert.equal(report.postReleaseComparison.releaseAnchorVerified, false);
  assert.deepEqual(report.postReleaseComparison.requiredWindows, [28, 56]);
  assert.equal(report.cancelledFollowOn.issue, 'LIP-185');
  assert.equal(report.cancelledFollowOn.status, 'canceled');
  assert.match(report.cancelledFollowOn.handling, /do not reactivate/i);
});
