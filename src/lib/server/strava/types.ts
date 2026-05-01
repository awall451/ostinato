/**
 * Subset of Strava API v3 response shapes that ostinato cares about.
 * Reference: https://developers.strava.com/docs/reference/
 */

export interface StravaTokenResponse {
	token_type: string;
	expires_at: number;
	expires_in: number;
	refresh_token: string;
	access_token: string;
	athlete?: StravaAthlete;
	scope?: string;
}

export interface StravaAthlete {
	id: number;
	username: string | null;
	firstname: string | null;
	lastname: string | null;
	ftp?: number | null;
	weight?: number | null; // kg
	measurement_preference?: 'feet' | 'meters' | string;
	bikes?: StravaGearSummary[];
	shoes?: StravaGearSummary[];
}

export interface StravaGearSummary {
	id: string;
	primary: boolean;
	name: string;
	resource_state: number;
	distance?: number;
	retired?: boolean;
	brand_name?: string | null;
	model_name?: string | null;
	frame_type?: number | null;
	description?: string | null;
}

// /gear/{id} — adds brand/model/frame_type vs SummaryGear.
export interface StravaGearDetailed extends StravaGearSummary {
	brand_name?: string | null;
	model_name?: string | null;
	frame_type?: number | null;
	weight?: number | null;
}

export interface StravaSummaryActivity {
	id: number;
	athlete: { id: number };
	name: string;
	type: string;
	sport_type: string;
	start_date: string; // ISO
	start_date_local: string; // ISO without TZ
	timezone?: string | null;
	utc_offset?: number;
	distance: number; // meters
	moving_time: number; // seconds
	elapsed_time: number;
	total_elevation_gain: number;
	elev_high?: number | null;
	elev_low?: number | null;
	gear_id?: string | null;
	trainer?: boolean;
	commute?: boolean;
	manual?: boolean;
	private?: boolean;
	average_speed?: number | null;
	max_speed?: number | null;
	average_watts?: number | null;
	weighted_average_watts?: number | null;
	max_watts?: number | null;
	kilojoules?: number | null;
	device_watts?: boolean;
	average_cadence?: number | null;
	has_heartrate?: boolean;
	average_heartrate?: number | null;
	max_heartrate?: number | null;
	suffer_score?: number | null;
	map?: { summary_polyline?: string | null };
	start_latlng?: [number, number] | null;
	end_latlng?: [number, number] | null;
}

export interface StravaDetailedActivity extends StravaSummaryActivity {
	calories?: number | null;
	description?: string | null;
}

export class StravaAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StravaAuthError';
	}
}

export class StravaRateLimitError extends Error {
	retryAfter: number;
	constructor(message: string, retryAfter = 60) {
		super(message);
		this.name = 'StravaRateLimitError';
		this.retryAfter = retryAfter;
	}
}
