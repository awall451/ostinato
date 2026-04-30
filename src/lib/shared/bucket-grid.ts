import type { Bucket } from './time';

/**
 * Returns a dense, monotonically-increasing array of bucket keys covering
 * [startEpoch, endEpoch], including periods that contain no activities.
 * Stub: returns empty array. Implemented in the green commit.
 */
export function bucketGrid(
	_startEpoch: number,
	_endEpoch: number,
	_bucket: Bucket
): string[] {
	return [];
}
