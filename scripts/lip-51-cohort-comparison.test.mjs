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

test('recalculates the four THE property CTRs and preserves daily coverage', () => {
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
	} }), /property source CTR does not match clicks divided by impressions/);
});

test('validates all family URL-row totals and keeps page rows separate from property totals', () => {
	assert.deepEqual(report.pageFamilySums, {
		prior90: { urlRows: 23380, clicks: 1222, impressions: 181270 },
		current90: { urlRows: 1275, clicks: 120, impressions: 13109 },
		prior28: { urlRows: 822, clicks: 35, impressions: 4094 },
		current28: { urlRows: 696, clicks: 85, impressions: 9015 },
	});
	assert.deepEqual(report.pageToPropertyChecks.prior90, {
		familyUrlRows: 23380,
		familyClicks: 1222,
		propertyClicks: 1220,
		clickDifference: -2,
		familyImpressions: 181270,
		propertyImpressions: 164937,
		impressionDifference: -16333,
		interpretation: 'Arithmetic check only. Page-family and property metrics have different reporting grains; differences are not residual attribution or a reconciliation.',
	});
	assert.equal(report.pageToPropertyChecks.current90.clickDifference, -2);
	assert.equal(report.pageToPropertyChecks.prior28.clickDifference, 0);
	assert.equal(report.pageToPropertyChecks.current28.clickDifference, -2);
	assert.throws(() => buildComparison({ ...evidence, pageFamilyMetrics: {
		...evidence.pageFamilyMetrics,
		current90: evidence.pageFamilyMetrics.current90.map((family, index) => index ? family : { ...family, urlRows: family.urlRows + 1 }),
	} }), /current90 THE URL-row total does not match the listed family rows/);
});

test('retains source-stated cohort rules and discloses row-level classification limits', () => {
	assert.equal(report.cohortDefinitions.theProperty.find(family => family.id === 'homepage-variants').sourceRule, 'Homepage path is /. Protocol and hostname URL rows remain distinct.');
	assert.equal(report.cohortDefinitions.oldDomainProperty.find(family => family.id === 'market').sourceRule, 'Path begins /northwest-houston or /cypress-real-estate.');
	assert.match(report.cohortDefinitions.oldDomainProperty.find(family => family.id === 'editorialRoot').sourceRule, /path shape, not intent proof/);
	assert.match(report.cohortDefinitions.oldDomainProperty.find(family => family.id === 'other').sourceRule, /All other returned page URLs/);
	assert.match(report.cohortDefinitions.reproducibilityLimit, /not copied/);
	assert.match(report.cohortDefinitions.reproducibilityLimit, /row-by-row cohort membership is not rebuilt/);
});

test('checks page-family CTRs and preserves absent rows separately from measured zeros', () => {
	const idx = report.pageFamilies.find(family => family.id === 'property-search');
	assert.deepEqual(idx.windows.current90, {
		urlRows: 1186,
		clicks: 23,
		impressions: 2704,
		sourceCtrDecimal: 0.008505917159763314,
		ctrDecimal: 23 / 2704,
		ctrPercent: 0.8506,
	});
	const agents = report.pageFamilies.find(family => family.id === 'agents');
	assert.deepEqual(agents.windows.prior28, {
		urlRows: 0,
		clicks: null,
		impressions: null,
		sourceCtrDecimal: null,
		ctrDecimal: null,
		ctrPercent: null,
		observation: 'no returned page rows',
	});
	assert.equal(agents.windows.current90.clicks, 0);
	assert.equal(agents.windows.current90.impressions, 3);
	assert.equal(agents.windows.current90.ctrPercent, 0);
	assert.equal(agents.comparisons.prior28ToCurrent28, null);
	assert.throws(() => buildComparison({ ...evidence, pageFamilyMetrics: {
		...evidence.pageFamilyMetrics,
		current90: evidence.pageFamilyMetrics.current90.map((family, index) => index ? family : { ...family, sourceCtrDecimal: 0.5 }),
	} }), /property-search CTR does not match clicks divided by impressions/);
	assert.throws(() => buildComparison({ ...evidence, pageFamilyMetrics: {
		...evidence.pageFamilyMetrics,
		prior28: evidence.pageFamilyMetrics.prior28.map((family, index) => index === 3 ? { ...family, clicks: 0 } : family),
	} }), /agents must preserve no-row metrics as null/);
});

test('validates the IDX subcohort partition against the parent property-search family', () => {
	for (const period of ['prior90', 'current90', 'prior28', 'current28']) {
		assert.equal(report.idxPartitionChecks[period].matches, true);
		assert.deepEqual(report.idxSubcohortSums[period], {
			urlRows: report.pageFamilies.find(family => family.id === 'property-search').windows[period].urlRows,
			clicks: report.pageFamilies.find(family => family.id === 'property-search').windows[period].clicks ?? 0,
			impressions: report.pageFamilies.find(family => family.id === 'property-search').windows[period].impressions ?? 0,
		});
	}
	assert.deepEqual(report.idxSubcohortSums.prior90, { urlRows: 23110, clicks: 840, impressions: 112742 });
	assert.deepEqual(report.idxSubcohortSums.current28, { urlRows: 612, clicks: 12, impressions: 1129 });
	assert.match(evidence.idxSubcohorts.statusLimit, /do not classify the remaining URLs/i);
});

test('keeps old-domain family and property metrics separate from THE', () => {
	assert.equal(report.otherPropertyScopes.separateDomainProperty, 'sc-domain:lippincottteam.com');
	assert.deepEqual(report.oldDomainPageFamilySums, {
		prior90: { urlRows: 42, clicks: 131, impressions: 28548 },
		current90: { urlRows: 41, clicks: 261, impressions: 33301 },
		prior28: { urlRows: 33, clicks: 97, impressions: 9322 },
		current28: { urlRows: 24, clicks: 20, impressions: 2701 },
	});
	assert.deepEqual({
		clicks: report.separateDomainPropertyTotals.prior28.clicks,
		impressions: report.separateDomainPropertyTotals.prior28.impressions,
		ctrPercent: report.separateDomainPropertyTotals.prior28.ctrPercent,
	}, { clicks: 97, impressions: 7048, ctrPercent: 1.3763 });
	assert.equal(report.separateDomainPropertyTotals.current90.coverage.returnedDays, 90);
	assert.equal(report.oldDomainPageToPropertyChecks.current90.clickDifference, -1);
	assert.equal(evidence.otherPropertyScopes.overlappingUrlPrefixProperty.includes('excluded'), true);
});

test('preserves query disclosure limits without reproducing the selected query set', () => {
	assert.equal(report.queryMetrics.state, 'disclosed_subset_not_reproduced');
	assert.equal(report.queryMetrics.selectedQueryRows, 253);
	assert.equal(report.queryMetrics.sourceCurrentThePageQueryRows, 736);
	assert.match(report.queryMetrics.disclosure, /Undisclosed clicks are not assigned to nonbrand/);
	assert.match(report.queryMetrics.disclosure, /no query movement is inferred/);
});

test('keeps missing daily rows distinct from zero and records the settled cutoff', () => {
	assert.deepEqual(report.dailyCoverage.prior90, { returnedDays: 86, windowDays: 90, missingDays: 4, fraction: 86 / 90 });
	assert.deepEqual(report.dailyCoverage.current90, { returnedDays: 41, windowDays: 90, missingDays: 49, fraction: 41 / 90 });
	assert.equal(report.missingDailyRows.from, '2026-07-03');
	assert.equal(report.missingDailyRows.through, '2026-08-24');
	assert.equal(report.firstResumedRow, '2026-08-25');
	assert.equal(report.settledCutoff, '2026-10-04');
	assert.equal(report.nextDayIncomplete, '2026-10-05');
	assert.ok(report.comparisonLimits.some(limit => /Do not treat missing rows as zero/.test(limit)));
});

test('uses the 17-route sample and does not require exhaustive historical inventory', async () => {
	assert.equal(report.routeProbeSample.count, 17);
	assert.equal(report.routeProbeSample.observedAt, '2026-10-06');
	const audit = await readFile(new URL('../docs/audits/2026-10-13-lip-184-url-cohort-map.md', import.meta.url), 'utf8');
	const ids = [...audit.matchAll(/\| MIG-(\d{3}) \|/g)].map(match => Number(match[1]));
	assert.deepEqual(ids, Array.from({ length: 17 }, (_, index) => index + 1));
	assert.match(audit, /bounded sample/i);
	assert.match(audit, /not an exhaustive former-site export/i);
	assert.match(audit, /transferred from the parent thread/i);
});

test('defers post-release analysis until LIP-189 is verified and does not revive LIP-185', () => {
	assert.equal(report.postReleaseComparison.status, 'deferred');
	assert.equal(report.postReleaseComparison.releaseAnchorIssue, 'LIP-189');
	assert.equal(report.postReleaseComparison.releaseAnchorVerified, false);
	assert.deepEqual(report.postReleaseComparison.requiredWindows, [28, 56]);
	assert.equal(report.cancelledFollowOn.issue, 'LIP-185');
	assert.equal(report.cancelledFollowOn.status, 'canceled');
	assert.match(report.cancelledFollowOn.handling, /do not reactivate/i);
});
