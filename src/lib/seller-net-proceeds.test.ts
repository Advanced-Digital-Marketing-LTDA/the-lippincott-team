import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	calculateSellerNetProceeds,
	formatCurrencyCents,
	MAX_CURRENCY_CENTS,
	parseCurrencyCents,
	parsePercentage,
	type SellerNetProceedsInput,
	type SellerNetProceedsResult,
} from './seller-net-proceeds.js';

function baseInput(): SellerNetProceedsInput {
	return {
		salePrice: '400000',
		payoffs: { firstMortgage: '200000', additional: ['10000'] },
		closingCostMode: 'aggregate',
		aggregateClosingCosts: '19000',
		detailedClosingCosts: {
			listingCompensation: { mode: 'percent', value: '' },
			buyerAgentCompensation: { mode: 'dollars', value: '' },
			titleEscrow: '',
			propertyTaxHoaSettlement: '',
			concessions: '',
			repairsWarrantySurvey: '',
			other: '',
		},
		otherExpenses: { preparation: '', moving: '', carrying: '' },
	};
}

function detailedInput(): SellerNetProceedsInput {
	const input = baseInput();
	input.closingCostMode = 'detailed';
	input.detailedClosingCosts.listingCompensation = { mode: 'percent', value: '2' };
	input.detailedClosingCosts.buyerAgentCompensation = { mode: 'dollars', value: '6000' };
	input.detailedClosingCosts.other = '5000';
	return input;
}

function result(input: SellerNetProceedsInput): SellerNetProceedsResult {
	const outcome = calculateSellerNetProceeds(input);
	if (!outcome.ok) throw new Error(`Unexpected validation errors: ${JSON.stringify(outcome.errors)}`);
	return outcome.result;
}

test('aggregate cost mode subtracts shared first and additional loan payoffs', () => {
	const calculated = result(baseInput());
	assert.equal(calculated.totalPayoffsCents, 21_000_000n);
	assert.equal(calculated.totalClosingCostsCents, 1_900_000n);
	assert.equal(calculated.cashAtClosingCents, 17_100_000n);
	assert.equal(calculated.amountAfterOtherExpensesCents, 17_100_000n);
});

test('detailed mode substitutes itemized costs and rounds percentage lines once', () => {
	const input = detailedInput();
	input.aggregateClosingCosts = '999999';

	const calculated = result(input);
	assert.equal(calculated.totalClosingCostsCents, 1_900_000n);
	assert.equal(calculated.cashAtClosingCents, 17_100_000n);
	assert.equal(calculated.inactiveClosingCostMode, 'aggregate');
	assert.deepEqual(calculated.closingCostLines.map((line) => line.cents), [800_000n, 600_000n, 500_000n]);
});

test('other expenses are separate from cash at closing', () => {
	const input = detailedInput();
	input.otherExpenses.preparation = '3000';

	const calculated = result(input);
	assert.equal(calculated.cashAtClosingCents, 17_100_000n);
	assert.equal(calculated.totalOtherExpensesCents, 300_000n);
	assert.equal(calculated.amountAfterOtherExpensesCents, 16_800_000n);
});

test('negative proceeds remain negative and format without clamping', () => {
	const input = baseInput();
	input.salePrice = '400000';
	input.payoffs = { firstMortgage: '396000', additional: [] };
	input.aggregateClosingCosts = '19000';

	const calculated = result(input);
	assert.equal(calculated.cashAtClosingCents, -1_500_000n);
	assert.equal(formatCurrencyCents(calculated.cashAtClosingCents), '-$15,000.00');
});

test('each percentage line rounds half-up independently to integer cents', () => {
	const input = baseInput();
	input.salePrice = '1.00';
	input.payoffs = { firstMortgage: '', additional: [] };
	input.closingCostMode = 'detailed';
	input.aggregateClosingCosts = '';
	input.detailedClosingCosts.listingCompensation = { mode: 'percent', value: '0.5' };
	input.detailedClosingCosts.buyerAgentCompensation = { mode: 'percent', value: '0.5' };

	const calculated = result(input);
	assert.deepEqual(calculated.closingCostLines.map((line) => line.cents), [1n, 1n]);
	assert.equal(calculated.totalClosingCostsCents, 2n);
	assert.equal(calculated.cashAtClosingCents, 98n);

	input.detailedClosingCosts.buyerAgentCompensation = { mode: 'dollars', value: '' };
	assert.equal(result(input).totalClosingCostsCents, 1n);
});

test('blank optional inputs are omitted while explicit zero remains an entered line', () => {
	const input = baseInput();
	input.payoffs.additional = [''];
	input.detailedClosingCosts.listingCompensation = { mode: 'dollars', value: '0' };
	input.detailedClosingCosts.buyerAgentCompensation = { mode: 'dollars', value: '' };
	input.detailedClosingCosts.other = '0';
	input.closingCostMode = 'detailed';
	input.aggregateClosingCosts = '';

	const calculated = result(input);
	assert.deepEqual(calculated.closingCostLines.map((line) => line.cents), [0n, 0n]);
	assert.ok(calculated.omittedFields.includes('Additional loan payoff 1'));
	assert.ok(calculated.omittedFields.includes('Buyer-agent compensation'));
	assert.ok(!calculated.omittedFields.includes('Listing-side compensation'));
	assert.ok(!calculated.omittedFields.includes('Other closing expenses'));
});

test('inactive detailed values are preserved as inactive and do not affect aggregate mode', () => {
	const input = baseInput();
	input.detailedClosingCosts.listingCompensation = { mode: 'percent', value: 'not a rate' };
	input.detailedClosingCosts.other = '123456';

	const calculated = result(input);
	assert.equal(calculated.cashAtClosingCents, 17_100_000n);
	assert.equal(calculated.inactiveClosingCostMode, 'detailed');
});

test('currency parser handles grouped dollars and rejects malformed or negative values', () => {
	assert.deepEqual(parseCurrencyCents(' $400,000.05 '), { kind: 'value', value: 40_000_005n });
	assert.deepEqual(parseCurrencyCents('.5'), { kind: 'value', value: 50n });
	assert.deepEqual(parseCurrencyCents('0'), { kind: 'value', value: 0n });
	assert.equal(parseCurrencyCents(' ').kind, 'blank');
	assert.equal(parseCurrencyCents('1,23').kind, 'invalid');
	assert.equal(parseCurrencyCents('12.345').kind, 'invalid');
	assert.equal(parseCurrencyCents('-1.00').kind, 'invalid');
	assert.equal(parseCurrencyCents('Infinity').kind, 'invalid');
	assert.equal(parseCurrencyCents('1e309').kind, 'invalid');
	assert.equal(parseCurrencyCents('1000000000000.00').kind, 'value');
	assert.equal(parseCurrencyCents('1000000000000.01').kind, 'invalid');
	assert.equal(MAX_CURRENCY_CENTS, 100_000_000_000_000n);
});

test('percentage parser accepts the inclusive 0–100 range and rejects invalid values', () => {
	assert.equal(parsePercentage('0').kind, 'value');
	assert.equal(parsePercentage('100%').kind, 'value');
	assert.equal(parsePercentage(' ').kind, 'blank');
	assert.equal(parsePercentage('-0.01').kind, 'invalid');
	assert.equal(parsePercentage('100.01').kind, 'invalid');
	assert.equal(parsePercentage('Infinity').kind, 'invalid');
	assert.equal(parsePercentage('1e2').kind, 'invalid');
});

test('required sale price and active cost inputs produce clear errors', () => {
	const input = baseInput();
	input.salePrice = '';
	input.payoffs.firstMortgage = '-100';
	input.aggregateClosingCosts = 'not dollars';
	const outcome = calculateSellerNetProceeds(input);
	assert.equal(outcome.ok, false);
	if (outcome.ok) return;
	assert.match(outcome.errors.salePrice, /expected sale price/i);
	assert.match(outcome.errors['payoffs.firstMortgage'], /nonnegative/i);
	assert.match(outcome.errors.aggregateClosingCosts, /dollar amount/i);
});

test('zero sale price and out-of-range active percentage values are invalid', () => {
	const zeroPrice = baseInput();
	zeroPrice.salePrice = '0';
	const zeroOutcome = calculateSellerNetProceeds(zeroPrice);
	assert.equal(zeroOutcome.ok, false);
	if (zeroOutcome.ok) return;
	assert.match(zeroOutcome.errors.salePrice, /greater than/i);

	const outOfRange = baseInput();
	outOfRange.closingCostMode = 'detailed';
	outOfRange.detailedClosingCosts.listingCompensation = { mode: 'percent', value: '101' };
	const rateOutcome = calculateSellerNetProceeds(outOfRange);
	assert.equal(rateOutcome.ok, false);
	if (rateOutcome.ok) return;
	assert.match(rateOutcome.errors['detailedClosingCosts.listingCompensation.value'], /0 to 100/);
});
