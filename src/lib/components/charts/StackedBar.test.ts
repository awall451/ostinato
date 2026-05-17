import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StackedBar from './StackedBar.svelte';

type BucketRow = {
	key: string;
	label: string;
	perSeries: Map<string, number>;
};

const threeBuckets: BucketRow[] = [
	{ key: '2024-01', label: 'Jan', perSeries: new Map([['MTB', 5], ['Road', 3]]) },
	{ key: '2024-02', label: 'Feb', perSeries: new Map([['MTB', 2], ['Road', 7]]) },
	{ key: '2024-03', label: 'Mar', perSeries: new Map([['MTB', 4], ['Road', 1]]) },
];
const series = ['MTB', 'Road'];

describe('StackedBar', () => {
	it('renders one bar group per bucket (at least one rect per bucket)', () => {
		const { container } = render(StackedBar, { props: { buckets: threeBuckets, series } });

		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();

		const rects = Array.from(container.querySelectorAll('rect'));
		// Each non-empty bucket produces one rect per non-zero series segment.
		// 3 buckets × 2 non-zero series = 6 rects total.
		// Distinct x positions confirm 3 separate bar groups.
		const xPositions = new Set(rects.map((r) => r.getAttribute('x')));
		expect(xPositions.size).toBe(3);
	});

	it('outer svg has width:100% for responsive sizing', () => {
		const { container } = render(StackedBar, { props: { buckets: threeBuckets, series } });

		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg!.getAttribute('style')).toContain('width:100%');
	});
});
