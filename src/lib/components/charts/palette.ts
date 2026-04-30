/**
 * Chart palette — readable on the Tokyo Night dark theme and the light fallback.
 * Indexed cyclically via `pc(i)`. Keep the order stable so adding new sport
 * types does not reshuffle existing colors.
 */
export const PALETTE = [
	'#7aa2f7', // accent blue   — Road / Ride
	'#9ece6a', // green         — MTB
	'#bb9af7', // purple        — eMTB
	'#e0af68', // amber         — Gravel
	'#f7768e', // red/pink      — Run
	'#7dcfff', // cyan          — TrailRun
	'#ff9e64', // orange        — Walk / Hike
	'#73daca', // teal          — Swim
	'#c0caf5', // light fg      — Workout
	'#565f89' // muted slate   — Other
] as const;

export function pc(i: number): string {
	return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
