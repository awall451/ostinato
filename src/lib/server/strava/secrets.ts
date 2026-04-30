import { existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type StravaSecrets = {
	athlete_id: number;
	access_token: string;
	refresh_token: string;
	expires_at: number; // epoch seconds
	scope: string;
	connected_at: number;
};

function path(): string {
	return process.env.OSTINATO_SECRETS_PATH ?? './data/secrets.json';
}

export function hasSecrets(): boolean {
	return existsSync(path());
}

export function readSecrets(): StravaSecrets | null {
	const p = path();
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf-8')) as StravaSecrets;
	} catch {
		return null;
	}
}

export function writeSecrets(s: StravaSecrets): void {
	const p = path();
	mkdirSync(dirname(p), { recursive: true });
	writeFileSync(p, JSON.stringify(s, null, 2));
	try {
		chmodSync(p, 0o600);
	} catch {
		// Windows / unusual filesystems — best effort.
	}
}

export function clearSecrets(): void {
	const p = path();
	if (existsSync(p)) unlinkSync(p);
}
