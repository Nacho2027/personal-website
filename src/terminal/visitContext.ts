/**
 * Visit context — a client-side snapshot of the visitor's local time and
 * session history, handed to PROMETHEUS so it can tailor tone and phrasing.
 *
 * All storage is localStorage; nothing leaves the browser beyond what gets
 * attached to the /api/chat request body (a few small fields, no identifiers).
 */

export type TimeOfDay =
	| "late_night"
	| "morning"
	| "midday"
	| "evening"
	| "night";

export type Mood = "melancholy" | "sardonic" | "contemplative" | "resigned";

export interface VisitContext {
	hour: number; // 0-23, visitor-local
	dayOfWeek: number; // 0-6, 0 = Sunday
	isWeekend: boolean;
	timeOfDay: TimeOfDay;
	mood: Mood;
	visitCount: number; // includes the current visit
	isFirstVisit: boolean;
	minutesSinceLastVisit: number | null;
}

const VISIT_COUNT_KEY = "prometheus.visitCount";
const LAST_VISIT_KEY = "prometheus.lastVisit";

function safeGetItem(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		// Private mode / disabled storage — degrade to stateless.
		return null;
	}
}

function safeSetItem(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore — stateless fallback.
	}
}

function computeTimeOfDay(hour: number): TimeOfDay {
	if (hour < 5) return "late_night";
	if (hour < 11) return "morning";
	if (hour < 17) return "midday";
	if (hour < 21) return "evening";
	return "night";
}

function computeMood(timeOfDay: TimeOfDay): Mood {
	switch (timeOfDay) {
		case "late_night":
			return "melancholy";
		case "morning":
			return "resigned";
		case "midday":
			return "sardonic";
		case "evening":
			return "contemplative";
		case "night":
			return "melancholy";
	}
}

/**
 * Build and persist the visit context.
 *
 * Side effect: increments the stored visit count and updates the last-visit
 * timestamp. Call exactly once per page load — callers should cache the
 * result if they need to read it multiple times in a session.
 */
export function getVisitContext(): VisitContext {
	const now = new Date();
	const hour = now.getHours();
	const dayOfWeek = now.getDay();
	const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
	const timeOfDay = computeTimeOfDay(hour);
	const mood = computeMood(timeOfDay);

	const storedCount = Number.parseInt(
		safeGetItem(VISIT_COUNT_KEY) ?? "0",
		10,
	);
	const prevCount = Number.isFinite(storedCount) ? storedCount : 0;
	const visitCount = prevCount + 1;
	const isFirstVisit = prevCount === 0;

	const lastVisitRaw = safeGetItem(LAST_VISIT_KEY);
	let minutesSinceLastVisit: number | null = null;
	if (lastVisitRaw) {
		const lastVisitMs = Number.parseInt(lastVisitRaw, 10);
		if (Number.isFinite(lastVisitMs)) {
			const diffMs = now.getTime() - lastVisitMs;
			if (diffMs >= 0) {
				minutesSinceLastVisit = Math.floor(diffMs / 60_000);
			}
		}
	}

	safeSetItem(VISIT_COUNT_KEY, String(visitCount));
	safeSetItem(LAST_VISIT_KEY, String(now.getTime()));

	return {
		hour,
		dayOfWeek,
		isWeekend,
		timeOfDay,
		mood,
		visitCount,
		isFirstVisit,
		minutesSinceLastVisit,
	};
}
