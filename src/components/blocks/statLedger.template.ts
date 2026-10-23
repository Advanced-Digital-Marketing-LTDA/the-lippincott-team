import type { Template } from 'tinacms';

export const statLedgerBlockSchema: Template = {
	name: 'statLedger',
	label: 'Stat Ledger',
	fields: [
		{ type: 'string', label: 'Title', name: 'title', description: 'Wrap a phrase in **double asterisks** to render it as the italic accent.' },
		{ type: 'rich-text', label: 'Summary', name: 'summary', description: 'Lede paragraph under the title (links allowed).' },
		{
			type: 'object', label: 'Tiles', name: 'tiles', list: true,
			ui: {
				defaultItem: { figure: '$450,000', label: 'Median list price', source: 'HAR.com · Sep 2026' },
				itemProps: (i: { figure?: string; label?: string }) => ({ label: `${i.figure ?? ''} ${i.label ?? ''}`.trim() }),
			},
			fields: [
				{ type: 'string', label: 'Figure', name: 'figure', description: 'Big figure (e.g. "$445,000"). Leave empty for a label + body tile instead.' },
				{ type: 'string', label: 'Label', name: 'label' },
				{ type: 'string', label: 'Source', name: 'source', description: 'Small attribution line under the label.' },
				{ type: 'rich-text', label: 'Body', name: 'body', description: 'Paragraph tile body (used when Figure is empty).' },
				{ type: 'boolean', label: 'Invert (dark tile)', name: 'invert' },
			],
		},
		{ type: 'rich-text', label: 'Note', name: 'note', description: 'Small muted caption under the ledger.' },
	],
	ui: {
		defaultItem: {
			title: 'What is the market doing **this year?**',
			tiles: [
				{ figure: '$450,000', label: 'Median list price', source: 'HAR.com · Sep 2026' },
				{ figure: '42 days', label: 'Median active-listing days', source: 'HAR.com · Sep 2026' },
				{ figure: '98%', label: 'Of asking price', source: 'Sale-to-list · Realtor.com', invert: true },
			],
		},
	},
};
