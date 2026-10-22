import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const evidenceUrl = new URL('../docs/audits/lip-51-bounded-cohort-data.json', import.meta.url);

function inclusiveDays(from, through) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${through}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error(`Invalid inclusive date window: ${from} through ${through}`);
  }
  return Math.floor((end - start) / 86_400_000) + 1;
}

function assertCount(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function calculatePropertyTotals(metrics, periodNames, coverage) {
  return Object.fromEntries(periodNames.map(period => {
    const totals = metrics[period];
    assertCount(totals.clicks, `${period} property clicks`);
    assertCount(totals.impressions, `${period} property impressions`);
    if (!totals.impressions) throw new Error(`${period} property impressions must be present and non-zero for CTR`);
    const ctrDecimal = totals.clicks / totals.impressions;
    if (!Number.isFinite(totals.sourceCtrDecimal) || Math.abs(ctrDecimal - totals.sourceCtrDecimal) > 1e-12) {
      throw new Error(`${period} source CTR does not match clicks divided by impressions`);
    }
    if (!Number.isFinite(totals.averagePosition) || totals.averagePosition <= 0) {
      throw new Error(`${period} average position must be a positive finite number`);
    }
    return [period, {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctrDecimal,
      ctrPercent: Number((ctrDecimal * 100).toFixed(4)),
      averagePosition: totals.averagePosition,
      coverage: coverage[period],
    }];
  }));
}

export function buildComparison(evidence) {
  if (evidence?.schemaVersion !== 1) throw new Error('Unsupported LIP-51 evidence schema');

  for (const [name, window] of Object.entries(evidence.windows)) {
    const actualDays = inclusiveDays(window.from, window.through);
    if (actualDays !== window.days) throw new Error(`${name} declares ${window.days} days but spans ${actualDays}`);
  }

  const coverage = {};
  for (const [period, sample] of Object.entries(evidence.dailyCoverage)) {
    if (!Object.hasOwn(evidence.windows, period)) continue;
    assertCount(sample.returnedDays, `${period} returnedDays`);
    assertCount(sample.windowDays, `${period} windowDays`);
    if (sample.windowDays !== evidence.windows[period].days || sample.returnedDays > sample.windowDays) {
      throw new Error(`${period} daily coverage does not match its settled window`);
    }
    coverage[period] = {
      returnedDays: sample.returnedDays,
      windowDays: sample.windowDays,
      missingDays: sample.windowDays - sample.returnedDays,
      fraction: sample.returnedDays / sample.windowDays,
    };
  }

  const familyMaps = {};
  for (const period of ['prior90', 'current90']) {
    const entries = evidence.pageFamilyMetrics[period];
    const map = new Map();
    for (const family of entries) {
      if (map.has(family.id)) throw new Error(`Duplicate ${period} page family: ${family.id}`);
      assertCount(family.urlRows, `${period} ${family.id} urlRows`);
      assertCount(family.clicks, `${period} ${family.id} clicks`);
      map.set(family.id, family);
    }
    familyMaps[period] = map;
  }

  const familyIds = [...familyMaps.prior90.keys()];
  if (familyIds.length !== familyMaps.current90.size || familyIds.some(id => !familyMaps.current90.has(id))) {
    throw new Error('Prior and current windows must use the same page-family IDs');
  }

  const families = familyIds.map(id => {
    const prior = familyMaps.prior90.get(id);
    const current = familyMaps.current90.get(id);
    if (prior.label !== current.label) throw new Error(`Page-family label changed for ${id}`);
    return {
      id,
      label: prior.label,
      prior90: { urlRows: prior.urlRows, clicks: prior.clicks },
      current90: { urlRows: current.urlRows, clicks: current.clicks },
      rawDifference: {
        urlRows: current.urlRows - prior.urlRows,
        clicks: current.clicks - prior.clicks,
      },
      impressions: 'not provided',
      ctr: 'not calculated',
    };
  });

  const familySums = Object.fromEntries(['prior90', 'current90'].map(period => [period, {
    urlRows: evidence.pageFamilyMetrics[period].reduce((total, family) => total + family.urlRows, 0),
    clicks: evidence.pageFamilyMetrics[period].reduce((total, family) => total + family.clicks, 0),
  }]));

  const periodNames = ['prior90', 'current90', 'prior28', 'current28'];
  const propertyPeriods = calculatePropertyTotals(evidence.propertyTotals, periodNames, coverage);
  const separatePropertyMetrics = evidence.otherPropertyScopes.separateDomainMetrics;
  const separateCoverage = separatePropertyMetrics
    ? Object.fromEntries(periodNames.map(period => [period, {
      returnedDays: separatePropertyMetrics[period].returnedDays,
      windowDays: separatePropertyMetrics[period].windowDays,
      missingDays: separatePropertyMetrics[period].windowDays - separatePropertyMetrics[period].returnedDays,
      fraction: separatePropertyMetrics[period].returnedDays / separatePropertyMetrics[period].windowDays,
    }]))
    : null;
  const separateDomainTotals = separatePropertyMetrics
    ? calculatePropertyTotals(separatePropertyMetrics, periodNames, separateCoverage)
    : null;

  const clickScopeCheck = Object.fromEntries(['prior90', 'current90'].map(period => [period, {
    listedPageFamilyClickSum: familySums[period].clicks,
    propertyClicks: propertyPeriods[period].clicks,
    arithmeticDifference: propertyPeriods[period].clicks - familySums[period].clicks,
    interpretation: 'Arithmetic check only. This is not an attributed residual or a reconciliation; keep page-family and property scopes separate.',
  }]));

  return {
    source: evidence.source,
    windows: evidence.windows,
    dailyCoverage: coverage,
    propertyTotals: propertyPeriods,
    separateDomainPropertyTotals: separateDomainTotals,
    pageFamilies: families,
    listedFamilySums: familySums,
    clickScopeCheck,
    missingDailyRows: evidence.dailyCoverage.noRowsReturned,
    firstResumedRow: evidence.dailyCoverage.firstResumedRow,
    settledCutoff: evidence.dailyCoverage.settledCutoff,
    nextDayIncomplete: evidence.dailyCoverage.nextDayIncomplete,
    otherPropertyScopes: evidence.otherPropertyScopes,
    queryMetrics: evidence.queryMetrics,
    routeProbeSample: evidence.routeProbeSample,
    postReleaseComparison: evidence.postReleaseComparison,
    cancelledFollowOn: evidence.cancelledFollowOn,
    comparisonLimits: [
      'CTR is calculated only from the supplied property-level clicks and impressions; page-family impressions and CTR are not provided.',
      'The 28-day values are historical baseline windows. They do not satisfy the deferred post-release comparison, which requires a verified LIP-189 release and recrawl anchor.',
      'The current 90-day window has returned daily rows for 41 of 90 dates, versus 86 of 90 in the prior window. Do not treat missing rows as zero or interpret the raw differences as causal.',
      'Page-family URL-row counts are reported Search Console rows, not inventory or unique-page counts. Listed family sums do not reconcile property totals.',
      'No query-level movement, complete historical URL inventory, ranking-loss cause, release date, or recrawl proof is established by this sample.',
    ],
  };
}

export async function loadEvidence() {
  return JSON.parse(await readFile(evidenceUrl, 'utf8'));
}

async function main() {
  const report = buildComparison(await loadEvidence());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
