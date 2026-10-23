import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const evidenceUrl = new URL('../docs/audits/lip-51-bounded-cohort-data.json', import.meta.url);
const periodNames = ['prior90', 'current90', 'prior28', 'current28'];
const comparisonLimits = [
  'CTR is recalculated from each supplied family or property clicks/impressions pair and checked against the source decimal fraction. A no-row family stays null; a returned row with zero clicks remains a measured zero.',
  'The 28-day values are historical baseline windows. They do not satisfy the deferred post-release comparison, which requires a verified LIP-189 release and recrawl anchor.',
  'The current 90-day window has returned daily rows for 41 of 90 dates, versus 86 of 90 in the prior window. Do not treat missing rows as zero or interpret the raw differences as causal.',
  'Page-family URL-row counts are reported Search Console rows, not inventory or unique-page counts. Page-level rows and property-level totals have different grains and must remain separate.',
  'The old domain property is separate from THE; the overlapping URL-prefix property is excluded. The 17 route probes classify only their exact URLs.',
  'Query metrics are a disclosed subset, not the full query set; undisclosed clicks are not assigned to nonbrand. No query-level movement, complete historical URL inventory, ranking-loss cause, release date, or recrawl proof is established by this sample.',
];

function inclusiveDays(from, through) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${through}T00:00:00Z`);
  assertValidDateWindow(start, end, from, through);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function assertValidDateWindow(start, end, from, through) {
  const error = `Invalid inclusive date window: ${from} through ${through}`;
  if (!Number.isFinite(start)) throw new Error(error);
  if (!Number.isFinite(end)) throw new Error(error);
  if (end < start) throw new Error(error);
}

function assertCount(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function calculateCtrMetrics(metrics, periodNames, scope) {
  return Object.fromEntries(periodNames.map(period => {
    const totals = metrics[period];
    assertCount(totals.clicks, `${period} ${scope} clicks`);
    assertCount(totals.impressions, `${period} ${scope} impressions`);
    if (!totals.impressions) throw new Error(`${period} ${scope} impressions must be present and non-zero for CTR`);
    const ctrDecimal = totals.clicks / totals.impressions;
    if (!Number.isFinite(totals.sourceCtrDecimal) || Math.abs(ctrDecimal - totals.sourceCtrDecimal) > 1e-12) {
      throw new Error(`${period} ${scope} source CTR does not match clicks divided by impressions`);
    }
    return [period, {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctrDecimal,
      ctrPercent: Number((ctrDecimal * 100).toFixed(4)),
    }];
  }));
}

function calculatePropertyTotals(metrics, periodNames, coverage, scope) {
  const ctrMetrics = calculateCtrMetrics(metrics, periodNames, scope);
  return Object.fromEntries(periodNames.map(period => {
    const totals = metrics[period];
    if (!Number.isFinite(totals.averagePosition) || totals.averagePosition <= 0) {
      throw new Error(`${period} ${scope} average position must be a positive finite number`);
    }
    return [period, {
      ...ctrMetrics[period],
      averagePosition: totals.averagePosition,
      coverage: coverage[period],
    }];
  }));
}

function validateFamilyWindows(metricSet, periods, scope) {
  const maps = Object.fromEntries(periods.map(period => [
    period,
    validatePeriodFamilies(metricSet[period], period, scope),
  ]));
  assertStableFamilyIds(maps, periods, scope);
  assertStableFamilyLabels(maps, periods, scope);
  return maps;
}

function validatePeriodFamilies(entries, period, scope) {
  if (!Array.isArray(entries)) throw new Error(`${scope} is missing ${period} rows`);
  const map = new Map();
  for (const family of entries) addFamilyToMap(map, family, period, scope);
  return map;
}

function addFamilyToMap(map, family, period, scope) {
  if (map.has(family.id)) throw new Error(`Duplicate ${period} ${scope} family: ${family.id}`);
  validateFamilyMetrics(family, period, scope);
  map.set(family.id, family);
}

function validateFamilyMetrics(family, period, scope) {
  const label = `${period} ${scope} ${family.id}`;
  assertCount(family.urlRows, `${label} urlRows`);
  if (family.urlRows === 0) return assertNoRowMetricsNull(family, label);
  assertCount(family.clicks, `${label} clicks`);
  assertCount(family.impressions, `${label} impressions`);
  if (!family.impressions) throw new Error(`${label} impressions must be present and non-zero`);
  assertFamilyCtr(family, label);
}

function assertNoRowMetricsNull(family, label) {
  if (family.clicks !== null) throw new Error(`${label} must preserve no-row metrics as null`);
  if (family.impressions !== null) throw new Error(`${label} must preserve no-row metrics as null`);
  if (family.sourceCtrDecimal !== null) throw new Error(`${label} must preserve no-row metrics as null`);
}

function assertFamilyCtr(family, label) {
  const ctrDecimal = family.clicks / family.impressions;
  const differsFromSource = Math.abs(ctrDecimal - family.sourceCtrDecimal) > 1e-12;
  if (!Number.isFinite(family.sourceCtrDecimal) || differsFromSource) {
    throw new Error(`${label} CTR does not match clicks divided by impressions`);
  }
}

function assertStableFamilyIds(maps, periods, scope) {
  const reference = maps[periods[0]];
  for (const period of periods.slice(1)) {
    const candidate = maps[period];
    if (!haveSameIds(reference, candidate)) throw new Error(`${scope} family IDs must be stable across windows`);
  }
}

function haveSameIds(reference, candidate) {
  if (reference.size !== candidate.size) return false;
  return [...reference.keys()].every(id => candidate.has(id));
}

function assertStableFamilyLabels(maps, periods, scope) {
  const ids = [...maps[periods[0]].keys()];
  for (const id of ids) {
    const labels = new Set(periods.map(period => maps[period].get(id).label));
    if (labels.size > 1) throw new Error(`${scope} label changed for ${id}`);
  }
}

function familySum(map) {
  let urlRows = 0;
  let clicks = 0;
  let impressions = 0;
  for (const family of map.values()) {
    urlRows += family.urlRows;
    if (family.urlRows === 0) continue;
    clicks += family.clicks;
    impressions += family.impressions;
  }
  return { urlRows, clicks, impressions };
}

function familyReport(maps, periods, totals, scope) {
  const sums = calculateFamilySums(maps, periods);
  assertExpectedFamilyRows(sums, periods, totals, scope);
  const pageToPropertyChecks = calculatePageToPropertyChecks(sums, periods, totals);
  const families = buildFamilyReports(maps, periods);
  return { families, sums, pageToPropertyChecks };
}

function calculateFamilySums(maps, periods) {
  return Object.fromEntries(periods.map(period => [period, familySum(maps[period])]));
}

function assertExpectedFamilyRows(sums, periods, totals, scope) {
  for (const period of periods) {
    const expectedRows = totals?.pageRows?.[period];
    if (expectedRows == null) continue;
    if (expectedRows !== sums[period].urlRows) {
      throw new Error(`${period} ${scope} URL-row total does not match the listed family rows`);
    }
  }
}

function calculatePageToPropertyChecks(sums, periods, totals) {
  return Object.fromEntries(periods.map(period => [
    period,
    buildPageToPropertyCheck(sums[period], totals?.property?.[period]),
  ]));
}

function buildPageToPropertyCheck(sum, property) {
  const propertyClicks = property?.clicks ?? null;
  const propertyImpressions = property?.impressions ?? null;
  return {
    familyUrlRows: sum.urlRows,
    familyClicks: sum.clicks,
    propertyClicks,
    clickDifference: differenceOrNull(propertyClicks, sum.clicks),
    familyImpressions: sum.impressions,
    propertyImpressions,
    impressionDifference: differenceOrNull(propertyImpressions, sum.impressions),
    interpretation: 'Arithmetic check only. Page-family and property metrics have different reporting grains; differences are not residual attribution or a reconciliation.',
  };
}

function differenceOrNull(propertyValue, familyValue) {
  if (propertyValue === null) return null;
  return propertyValue - familyValue;
}

function buildFamilyReports(maps, periods) {
  return [...maps[periods[0]].keys()].map(id => buildFamilyReport(id, maps, periods));
}

function buildFamilyReport(id, maps, periods) {
  const source = maps[periods[0]].get(id);
  return {
    id,
    label: source.label,
    windows: buildFamilyWindowReports(id, maps, periods),
    comparisons: buildFamilyComparisons(id, maps),
  };
}

function buildFamilyWindowReports(id, maps, periods) {
  return Object.fromEntries(periods.map(period => [period, buildFamilyWindowReport(maps[period].get(id))]));
}

function buildFamilyWindowReport(source) {
  if (source.urlRows === 0) {
    return { urlRows: 0, clicks: null, impressions: null, sourceCtrDecimal: null, ctrDecimal: null, ctrPercent: null, observation: 'no returned page rows' };
  }
  const ctrDecimal = source.clicks / source.impressions;
  return {
    urlRows: source.urlRows,
    clicks: source.clicks,
    impressions: source.impressions,
    sourceCtrDecimal: source.sourceCtrDecimal,
    ctrDecimal,
    ctrPercent: Number((ctrDecimal * 100).toFixed(4)),
  };
}

function buildFamilyComparisons(id, maps) {
  return {
    prior90ToCurrent90: compareFamilyRows(maps.prior90.get(id), maps.current90.get(id)),
    prior28ToCurrent28: compareFamilyRows(maps.prior28.get(id), maps.current28.get(id)),
  };
}

function compareFamilyRows(prior, current) {
  if (prior.urlRows === 0) return null;
  if (current.urlRows === 0) return null;
  return {
    urlRows: current.urlRows - prior.urlRows,
    clicks: current.clicks - prior.clicks,
    impressions: current.impressions - prior.impressions,
    interpretation: 'Raw arithmetic difference only; not a causal or complete-inventory comparison.',
  };
}

function calculateDailyCoverage(evidence) {
  const coverage = {};
  for (const [period, sample] of Object.entries(evidence.dailyCoverage)) {
    if (!Object.hasOwn(evidence.windows, period)) continue;
    coverage[period] = validateCoverageWindow(sample, evidence.windows[period], period);
  }
  return coverage;
}

function validateCoverageWindow(sample, window, period) {
  assertCount(sample.returnedDays, `${period} returnedDays`);
  assertCount(sample.windowDays, `${period} windowDays`);
  if (sample.windowDays !== window.days) throw new Error(`${period} daily coverage does not match its settled window`);
  if (sample.returnedDays > sample.windowDays) throw new Error(`${period} daily coverage does not match its settled window`);
  return {
    returnedDays: sample.returnedDays,
    windowDays: sample.windowDays,
    missingDays: sample.windowDays - sample.returnedDays,
    fraction: sample.returnedDays / sample.windowDays,
  };
}

function calculateSeparateCoverage(metrics, periods) {
  return Object.fromEntries(periods.map(period => [period, {
    returnedDays: metrics[period].returnedDays,
    windowDays: metrics[period].windowDays,
    missingDays: metrics[period].windowDays - metrics[period].returnedDays,
    fraction: metrics[period].returnedDays / metrics[period].windowDays,
  }]));
}

function calculateSeparateDomainTotals(otherPropertyScopes, periods) {
  const metrics = otherPropertyScopes.separateDomainMetrics;
  if (!metrics) return null;
  const coverage = calculateSeparateCoverage(metrics, periods);
  return calculatePropertyTotals(metrics, periods, coverage, 'old-domain property');
}

function buildIdxPartitions(familyMaps, idxMaps, periods) {
  const idxSums = Object.fromEntries(periods.map(period => [period, familySum(idxMaps[period])]));
  const idxPartitionChecks = Object.fromEntries(periods.map(period => [
    period,
    checkIdxPartition(familyMaps[period].get('property-search'), idxSums[period], period),
  ]));
  return { idxSums, idxPartitionChecks };
}

function checkIdxPartition(parent, part, period) {
  if (parent.urlRows !== part.urlRows) throw new Error(`${period} IDX subcohorts do not match the parent property-search family`);
  if (parent.urlRows === 0) return makeIdxCheck(parent, part);
  if (parent.clicks !== part.clicks) throw new Error(`${period} IDX subcohorts do not match the parent property-search family`);
  if (parent.impressions !== part.impressions) throw new Error(`${period} IDX subcohorts do not match the parent property-search family`);
  return makeIdxCheck(parent, part);
}

function makeIdxCheck(parent, part) {
  return {
    parentFamily: { urlRows: parent.urlRows, clicks: parent.clicks, impressions: parent.impressions },
    subcohortSum: part,
    matches: true,
  };
}

export function buildComparison(evidence) {
  if (evidence?.schemaVersion !== 2) throw new Error('Unsupported LIP-51 evidence schema');
  validateWindows(evidence.windows);
  const coverage = calculateDailyCoverage(evidence);
  const propertyPeriods = calculatePropertyTotals(evidence.propertyTotals, periodNames, coverage, 'THE property');
  const separateDomainTotals = calculateSeparateDomainTotals(evidence.otherPropertyScopes, periodNames);
  const familyMaps = validateFamilyWindows(evidence.pageFamilyMetrics, periodNames, 'THE');
  const theFamilies = familyReport(familyMaps, periodNames, {
    pageRows: evidence.pageFamilyMetrics.pageUrlRowTotals,
    property: propertyPeriods,
  }, 'THE');
  const oldFamilyMaps = validateFamilyWindows(evidence.otherPropertyScopes.pageFamilyMetrics, periodNames, 'old-domain');
  const oldFamilies = familyReport(oldFamilyMaps, periodNames, {
    pageRows: evidence.otherPropertyScopes.pageFamilyMetrics.pageUrlRowTotals,
    property: separateDomainTotals,
  }, 'old-domain');
  const idxMaps = validateFamilyWindows(evidence.idxSubcohorts, periodNames, 'IDX subcohort');
  const { idxSums, idxPartitionChecks } = buildIdxPartitions(familyMaps, idxMaps, periodNames);

  return {
    source: evidence.source,
    cohortDefinitions: evidence.cohortDefinitions,
    windows: evidence.windows,
    dailyCoverage: coverage,
    propertyTotals: propertyPeriods,
    separateDomainPropertyTotals: separateDomainTotals,
    pageFamilies: theFamilies.families,
    pageFamilySums: theFamilies.sums,
    pageToPropertyChecks: theFamilies.pageToPropertyChecks,
    oldDomainPageFamilies: oldFamilies.families,
    oldDomainPageFamilySums: oldFamilies.sums,
    oldDomainPageToPropertyChecks: oldFamilies.pageToPropertyChecks,
    idxSubcohorts: Object.fromEntries(periodNames.map(period => [period, [...idxMaps[period].values()]])),
    idxSubcohortSums: idxSums,
    idxPartitionChecks,
    missingDailyRows: evidence.dailyCoverage.noRowsReturned,
    firstResumedRow: evidence.dailyCoverage.firstResumedRow,
    settledCutoff: evidence.dailyCoverage.settledCutoff,
    nextDayIncomplete: evidence.dailyCoverage.nextDayIncomplete,
    otherPropertyScopes: evidence.otherPropertyScopes,
    queryMetrics: evidence.queryMetrics,
    routeProbeSample: evidence.routeProbeSample,
    postReleaseComparison: evidence.postReleaseComparison,
    cancelledFollowOn: evidence.cancelledFollowOn,
    comparisonLimits,
  };
}

function validateWindows(windows) {
  for (const [name, window] of Object.entries(windows)) {
    const actualDays = inclusiveDays(window.from, window.through);
    if (actualDays !== window.days) throw new Error(`${name} declares ${window.days} days but spans ${actualDays}`);
  }
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
