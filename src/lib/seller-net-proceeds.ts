export type ClosingCostMode = 'aggregate' | 'detailed';
export type DollarOrPercentInput = { mode: 'dollars' | 'percent'; value: string };

export interface SellerNetProceedsInput {
	salePrice: string;
	payoffs: {
		firstMortgage: string;
		additional: string[];
	};
	closingCostMode: ClosingCostMode;
	aggregateClosingCosts: string;
	detailedClosingCosts: {
		listingCompensation: DollarOrPercentInput;
		buyerAgentCompensation: DollarOrPercentInput;
		titleEscrow: string;
		propertyTaxHoaSettlement: string;
		concessions: string;
		repairsWarrantySurvey: string;
		other: string;
	};
	otherExpenses: {
		preparation: string;
		moving: string;
		carrying: string;
	};
}

export interface CostLine {
	field: string;
	label: string;
	cents: bigint;
}

export interface SellerNetProceedsResult {
	mode: ClosingCostMode;
	salePriceCents: bigint;
	payoffLines: CostLine[];
	closingCostLines: CostLine[];
	otherExpenseLines: CostLine[];
	totalPayoffsCents: bigint;
	totalClosingCostsCents: bigint;
	cashAtClosingCents: bigint;
	totalOtherExpensesCents: bigint;
	amountAfterOtherExpensesCents: bigint;
	omittedFields: string[];
	inactiveClosingCostMode: ClosingCostMode | null;
}

export type ParseResult<T> =
	| { kind: 'blank' }
	| { kind: 'invalid'; message: string }
	| { kind: 'value'; value: T };

export type SellerNetProceedsOutcome =
	| { ok: false; errors: Record<string, string> }
	| { ok: true; result: SellerNetProceedsResult };

const MAX_INPUT_LENGTH = 128;
/** Highest accepted amount is $1 trillion, far above a realistic residential estimate. */
export const MAX_CURRENCY_CENTS = 100_000_000_000_000n;
const CURRENCY_PATTERN = /^\$?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\.\d{1,2})$/;
const PERCENT_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/** Parses a nonnegative US-dollar amount to exact integer cents. */
export function parseCurrencyCents(raw: string): ParseResult<bigint> {
	const value = raw.trim();
	if (!value) return { kind: 'blank' };
	if (value.length > MAX_INPUT_LENGTH || !CURRENCY_PATTERN.test(value)) {
		return { kind: 'invalid', message: 'Enter a nonnegative dollar amount with up to two decimal places.' };
	}

	const normalized = value.replace(/^\$/, '').replaceAll(',', '');
	const [dollarsText, centsText = ''] = normalized.split('.');
	const dollars = dollarsText || '0';
	const cents = centsText.padEnd(2, '0');
	const amount = BigInt(dollars) * 100n + BigInt(cents || '0');
	if (amount > MAX_CURRENCY_CENTS) {
		return { kind: 'invalid', message: 'Enter an amount no greater than $1,000,000,000,000.00.' };
	}
	return { kind: 'value', value: amount };
}

interface PercentageRatio {
	numerator: bigint;
	scale: bigint;
}

/** Parses a percentage as an exact numerator/scale pair, without Number conversion. */
export function parsePercentage(raw: string): ParseResult<PercentageRatio> {
	let value = raw.trim();
	if (!value) return { kind: 'blank' };
	if (value.endsWith('%')) value = value.slice(0, -1).trimEnd();
	if (value.length > MAX_INPUT_LENGTH || !PERCENT_PATTERN.test(value)) {
		return { kind: 'invalid', message: 'Enter a percentage from 0 to 100.' };
	}

	const [wholeText, fraction = ''] = value.split('.');
	const whole = wholeText || '0';
	const scale = 10n ** BigInt(fraction.length);
	const numerator = BigInt(`${whole}${fraction}`);
	if (numerator > 100n * scale) {
		return { kind: 'invalid', message: 'Enter a percentage from 0 to 100.' };
	}

	return { kind: 'value', value: { numerator, scale } };
}

/** Rounds one percentage-based line to cents using half-up rounding. */
export function percentageCostCents(salePriceCents: bigint, rate: PercentageRatio): bigint {
	const denominator = 100n * rate.scale;
	const product = salePriceCents * rate.numerator;
	return (product + denominator / 2n) / denominator;
}

/** Formats exact cents for the US-dollar result display. */
export function formatCurrencyCents(cents: bigint): string {
	const negative = cents < 0n;
	const absolute = negative ? -cents : cents;
	const dollars = (absolute / 100n).toLocaleString('en-US');
	const fractional = (absolute % 100n).toString().padStart(2, '0');
	return `${negative ? '-' : ''}$${dollars}.${fractional}`;
}

function sumLines(lines: CostLine[]): bigint {
	return lines.reduce((total, line) => total + line.cents, 0n);
}

function hasValue(raw: string): boolean {
	return raw.trim().length > 0;
}

export function calculateSellerNetProceeds(input: SellerNetProceedsInput): SellerNetProceedsOutcome {
	const errors: Record<string, string> = {};
	const omittedFields: string[] = [];
	const payoffLines: CostLine[] = [];
	const closingCostLines: CostLine[] = [];
	const otherExpenseLines: CostLine[] = [];

	const salePrice = parseCurrencyCents(input.salePrice);
	let salePriceCents = 0n;
	if (salePrice.kind === 'blank') {
		errors.salePrice = 'Enter an expected sale price.';
	} else if (salePrice.kind === 'invalid') {
		errors.salePrice = salePrice.message;
	} else if (salePrice.value <= 0n) {
		errors.salePrice = 'Sale price must be greater than $0.00.';
	} else {
		salePriceCents = salePrice.value;
	}

	type MoneyLineInput = { raw: string; field: string; label: string };
	const addMoneyLine = (lines: CostLine[], { raw, field, label }: MoneyLineInput) => {
		const parsed = parseCurrencyCents(raw);
		if (parsed.kind === 'blank') {
			omittedFields.push(label);
		} else if (parsed.kind === 'invalid') {
			errors[field] = parsed.message;
		} else {
			lines.push({ field, label, cents: parsed.value });
		}
	};

	const payoffs = input.payoffs ?? { firstMortgage: '', additional: [] };
	addMoneyLine(payoffLines, { raw: payoffs.firstMortgage, field: 'payoffs.firstMortgage', label: 'First mortgage payoff' });
	(payoffs.additional ?? []).forEach((raw, index) => {
		addMoneyLine(payoffLines, { raw, field: `payoffs.additional.${index}`, label: `Additional loan payoff ${index + 1}` });
	});

	const addDollarOrPercentLine = (entry: DollarOrPercentInput, { field, label }: Pick<CostLine, 'field' | 'label'>) => {
		if (entry.mode === 'dollars') {
			addMoneyLine(closingCostLines, { raw: entry.value, field: `${field}.value`, label });
			return;
		}
		if (entry.mode !== 'percent') {
			errors[`${field}.mode`] = 'Choose dollars or percent.';
			return;
		}

		const parsed = parsePercentage(entry.value);
		if (parsed.kind === 'blank') {
			omittedFields.push(label);
			return;
		}
		if (parsed.kind === 'invalid') {
			errors[`${field}.value`] = parsed.message;
			return;
		}
		closingCostLines.push({
			field,
			label,
			cents: percentageCostCents(salePriceCents, parsed.value),
		});
	};

	let inactiveClosingCostMode: ClosingCostMode | null = null;
	if (input.closingCostMode === 'aggregate') {
		addMoneyLine(closingCostLines, { raw: input.aggregateClosingCosts, field: 'aggregateClosingCosts', label: 'Aggregate closing costs' });
		const detailed = input.detailedClosingCosts;
		if (
			hasValue(detailed.listingCompensation.value) ||
			hasValue(detailed.buyerAgentCompensation.value) ||
			[
				detailed.titleEscrow,
				detailed.propertyTaxHoaSettlement,
				detailed.concessions,
				detailed.repairsWarrantySurvey,
				detailed.other,
			].some(hasValue)
		) inactiveClosingCostMode = 'detailed';
	} else if (input.closingCostMode === 'detailed') {
		if (hasValue(input.aggregateClosingCosts)) inactiveClosingCostMode = 'aggregate';
		const detailed = input.detailedClosingCosts;
		addDollarOrPercentLine(detailed.listingCompensation, { field: 'detailedClosingCosts.listingCompensation', label: 'Listing-side compensation' });
		addDollarOrPercentLine(detailed.buyerAgentCompensation, { field: 'detailedClosingCosts.buyerAgentCompensation', label: 'Buyer-agent compensation' });
		addMoneyLine(closingCostLines, { raw: detailed.titleEscrow, field: 'detailedClosingCosts.titleEscrow', label: 'Seller-paid title and escrow' });
		addMoneyLine(closingCostLines, { raw: detailed.propertyTaxHoaSettlement, field: 'detailedClosingCosts.propertyTaxHoaSettlement', label: 'Property-tax and HOA settlement' });
		addMoneyLine(closingCostLines, { raw: detailed.concessions, field: 'detailedClosingCosts.concessions', label: 'Concessions' });
		addMoneyLine(closingCostLines, { raw: detailed.repairsWarrantySurvey, field: 'detailedClosingCosts.repairsWarrantySurvey', label: 'Repairs, warranty, and survey' });
		addMoneyLine(closingCostLines, { raw: detailed.other, field: 'detailedClosingCosts.other', label: 'Other closing expenses' });
	} else {
		errors.closingCostMode = 'Choose aggregate or detailed closing costs.';
	}

	const otherExpenses = input.otherExpenses ?? { preparation: '', moving: '', carrying: '' };
	addMoneyLine(otherExpenseLines, { raw: otherExpenses.preparation, field: 'otherExpenses.preparation', label: 'Preparation expenses' });
	addMoneyLine(otherExpenseLines, { raw: otherExpenses.moving, field: 'otherExpenses.moving', label: 'Moving expenses' });
	addMoneyLine(otherExpenseLines, { raw: otherExpenses.carrying, field: 'otherExpenses.carrying', label: 'Carrying expenses' });

	if (Object.keys(errors).length > 0) return { ok: false, errors };

	const totalPayoffsCents = sumLines(payoffLines);
	const totalClosingCostsCents = sumLines(closingCostLines);
	const cashAtClosingCents = salePriceCents - totalPayoffsCents - totalClosingCostsCents;
	const totalOtherExpensesCents = sumLines(otherExpenseLines);
	return {
		ok: true,
		result: {
			mode: input.closingCostMode,
			salePriceCents,
			payoffLines,
			closingCostLines,
			otherExpenseLines,
			totalPayoffsCents,
			totalClosingCostsCents,
			cashAtClosingCents,
			totalOtherExpensesCents,
			amountAfterOtherExpensesCents: cashAtClosingCents - totalOtherExpensesCents,
			omittedFields,
			inactiveClosingCostMode,
		},
	};
}
