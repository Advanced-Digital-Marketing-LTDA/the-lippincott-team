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

function validateFamilyWindows(metricSet, periodNames, scope) {
  const maps = {};
  for (const period of periodNames) {
    const entries = metricSet[period];
    if (!Array.isArray(entries)) throw new Error(`${scope} is missing ${period} rows`);
    const map = new Map();
    for (const family of entries) {
      if (map.has(family.id)) throw new Error(`Duplicate ${period} ${scope} family: ${family.id}`);
      assertCount(family.urlRows, `${period} ${scope} ${family.id} urlRows`);
      if (family.urlRows === 0) {
        if (family.clicks !== null || family.impressions !== null || family.sourceCtrDecimal !== null) {
          throw new Error(`${period} ${scope} ${family.id} must preserve no-row metrics as null`);
        }
      } else {
        assertCount(family.clicks, `${period} ${scope} ${family.id} clicks`);
        assertCount(family.impressions, `${period} ${scope} ${family.id} impressions`);
        if (!family.impressions) throw new Error(`${period} ${scope} ${family.id} impressions must be present and non-zero`);
        const ctrDecimal = family.clicks / family.impressions;
        if (!Number.isFinite(family.sourceCtrDecimal) || Math.abs(ctrDecimal - family.sourceCtrDecimal) > 1e-12) {
          throw new Error(`${period} ${scope} ${family.id} CTR does not match clicks divided by impressions`);
        }
      }
      map.set(family.id, family);
    }
    maps[period] = map;
  }

  const ids = [...maps[periodNames[0]].keys()];
  for (const period of periodNames.slice(1)) {
    if (ids.length !== maps[period].size || ids.some(id => !maps[period].has(id))) {
      throw new Error(`${scope} family IDs must be stable across windows`);
    }
  }
  for (const id of ids) {
    const label = maps[periodNames[0]].get(id).label;
    if (periodNames.some(period => maps[period].get(id).label !== label)) {
      throw new Error(`${scope} label changed for ${id}`);
    }
  }
  return maps;
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

function familyReport(maps, periodNames, totals, scope) {
  const sums = {};
  const reportedPageRows = {};
  for (const period of periodNames) {
    sums[period] = familySum(maps[period]);
    const expectedRows = totals?.pageRows?.[period];
    if (expectedRows != null && expectedRows !== sums[period].urlRows) {
      throw new Error(`${period} ${scope} URL-row total does not match the listed family rows`);
    }
    reportedPageRows[period] = {
      familyUrlRows: sums[period].urlRows,
      familyClicks: sums[period].clicks,
      propertyClicks: totals?.property[period]?.clicks ?? null,
      clickDifference: totals?.property[period]?.clicks == null ? null : totals.property[period].clicks - sums[period].clicks,
      familyImpressions: sums[period].impressions,
      propertyImpressions: totals?.property[period]?.impressions ?? null,
      impressionDifference: totals?.property[period]?.impressions == null ? null : totals.property[period].impressions - sums[period].impressions,
      interpretation: 'Arithmetic check only. Page-family and property metrics have different reporting grains; differences are not residual attribution or a reconciliation.',
    };
  }

  const families = [...maps[periodNames[0]].keys()].map(id => ({
    id,
    label: maps[periodNames[0]].get(id).label,
    windows: Object.fromEntries(periodNames.map(period => {
      const source = maps[period].get(id);
      if (source.urlRows === 0) return [period, { urlRows: 0, clicks: null, impressions: null, sourceCtrDecimal: null, ctrDecimal: null, ctrPercent: null, observation: 'no returned page rows' }];
      return [period, {
        urlRows: source.urlRows,
        clicks: source.clicks,
        impressions: source.impressions,
        sourceCtrDecimal: source.sourceCtrDecimal,
        ctrDecimal: source.clicks / source.impressions,
        ctrPercent: Number((source.clicks / source.impressions * 100).toFixed(4)),
      }];
    })),
    comparisons: {
      prior90ToCurrent90: compareFamilyRows(maps.prior90.get(id), maps.current90.get(id)),
      prior28ToCurrent28: compareFamilyRows(maps.prior28.get(id), maps.current28.get(id)),
    },
  }));

  return { families, sums, pageToPropertyChecks: reportedPageRows };
}

function compareFamilyRows(prior, current) {
  if (prior.urlRows === 0 || current.urlRows === 0) return null;
  return {
    urlRows: current.urlRows - prior.urlRows,
    clicks: current.clicks - prior.clicks,
    impressions: current.impressions - prior.impressions,
    interpretation: 'Raw arithmetic difference only; not a causal or complete-inventory comparison.',
  };
}

function partitionSum(map) {
  return familySum(map);
}

export function buildComparison(evidence) {
  if (evidence?.schemaVersion !== 2) throw new Error('Unsupported LIP-51 evidence schema');

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

  const periodNames = ['prior90', 'current90', 'prior28', 'current28'];
  const propertyPeriods = calculatePropertyTotals(evidence.propertyTotals, periodNames, coverage, 'THE property');
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
    ? calculatePropertyTotals(separatePropertyMetrics, periodNames, separateCoverage, 'old-domain property')
    : null;
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
  const idxSums = Object.fromEntries(periodNames.map(period => [period, partitionSum(idxMaps[period])]));
  const idxPartitionChecks = Object.fromEntries(periodNames.map(period => {
    const parent = familyMaps[period].get('property-search');
    const part = idxSums[period];
    if (parent.urlRows !== part.urlRows || (parent.urlRows > 0 && (parent.clicks !== part.clicks || parent.impressions !== part.impressions))) {
      throw new Error(`${period} IDX subcohorts do not match the parent property-search family`);
    }
    return [period, {
      parentFamily: { urlRows: parent.urlRows, clicks: parent.clicks, impressions: parent.impressions },
      subcohortSum: part,
      matches: true,
    }];
  }));

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
    comparisonLimits: [
      'CTR is recalculated from each supplied family or property clicks/impressions pair and checked against the source decimal fraction. A no-row family stays null; a returned row with zero clicks remains a measured zero.',
      'The 28-day values are historical baseline windows. They do not satisfy the deferred post-release comparison, which requires a verified LIP-189 release and recrawl anchor.',
      'The current 90-day window has returned daily rows for 41 of 90 dates, versus 86 of 90 in the prior window. Do not treat missing rows as zero or interpret the raw differences as causal.',
      'Page-family URL-row counts are reported Search Console rows, not inventory or unique-page counts. Page-level rows and property-level totals have different grains and must remain separate.',
      'The old domain property is separate from THE; the overlapping URL-prefix property is excluded. The 17 route probes classify only their exact URLs.',
      'Query metrics are a disclosed subset, not the full query set; undisclosed clicks are not assigned to nonbrand. No query-level movement, complete historical URL inventory, ranking-loss cause, release date, or recrawl proof is established by this sample.',
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
