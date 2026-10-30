import { describe, it, expect } from 'vitest';
import { parseComponentFields, parseDate, parseId } from './component-form';
import { M_PER_MI } from '$lib/shared/units';

function fd(o: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
}

describe('parseComponentFields', () => {
	it('converts display units to storage units', () => {
		const r = parseComponentFields(
			fd({
				kind: 'chain',
				brand: ' KMC ',
				model: '',
				wear_limit_mi: '2000',
				starting_mi: '150',
				price: '$42.50',
				purchased_at: '2025-06-01',
				count_trainer: 'on'
			})
		);
		expect(r).toEqual({
			kind: 'chain',
			brand: 'KMC',
			model: null,
			notes: null,
			wear_limit_m: 2000 * M_PER_MI,
			starting_distance_m: 150 * M_PER_MI,
			purchase_price_cents: 4250,
			purchased_at: Date.UTC(2025, 5, 1) / 1000,
			count_trainer: 1
		});
	});

	it('blank optional fields → nulls / defaults; unchecked trainer → 0', () => {
		const r = parseComponentFields(fd({ kind: 'tire_rear', wear_limit_mi: '0' }));
		expect(r).toMatchObject({
			wear_limit_m: null,
			starting_distance_m: 0,
			purchase_price_cents: null,
			purchased_at: null,
			count_trainer: 0
		});
	});

	it('requires kind', () => {
		expect(parseComponentFields(fd({}))).toEqual({ error: 'kind is required' });
	});
});

describe('parseDate / parseId', () => {
	it('parses or errors', () => {
		expect(parseDate(fd({ at: '2025-07-01' }), 'at')).toBe(Date.UTC(2025, 6, 1) / 1000);
		expect(parseDate(fd({ at: 'x' }), 'at')).toHaveProperty('error');
		expect(parseId(fd({ id: '7' }))).toBe(7);
		expect(parseId(fd({ id: 'abc' }))).toBeNull();
	});
});
