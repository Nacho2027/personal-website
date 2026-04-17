import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * System prompt loading:
 * - Production (Vercel): Reads from SYSTEM_PROMPT environment variable
 * - Local development: Reads from api/system-prompt.ts (gitignored)
 *
 * This keeps PROMETHEUS's personality private while allowing the repo to be public.
 */
function getSystemPrompt(): string {
	// First try environment variable (used in production)
	if (process.env.SYSTEM_PROMPT) {
		return process.env.SYSTEM_PROMPT;
	}

	// Fallback to local file for development (dynamically imported to avoid build errors)
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { SYSTEM_PROMPT } = require("./system-prompt");
		return SYSTEM_PROMPT;
	} catch {
		throw new Error("SYSTEM_PROMPT not configured. Set it as an environment variable or create api/system-prompt.ts");
	}
}

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mirrors the VisitContext shape sent by the frontend (src/terminal/visitContext.ts).
// Every field is optional on the server side — we degrade gracefully if any
// part of the payload is missing or malformed.
interface VisitContextPayload {
	hour?: number;
	dayOfWeek?: number;
	isWeekend?: boolean;
	timeOfDay?: string;
	mood?: string;
	visitCount?: number;
	isFirstVisit?: boolean;
	minutesSinceLastVisit?: number | null;
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

function formatRelative(minutes: number): string {
	if (minutes < 1) return "moments ago";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	if (minutes < 1440) {
		const h = Math.floor(minutes / 60);
		return `${h} hour${h === 1 ? "" : "s"} ago`;
	}
	const d = Math.floor(minutes / 1440);
	return `${d} day${d === 1 ? "" : "s"} ago`;
}

function buildVisitContextBlock(ctx: VisitContextPayload | undefined): string {
	if (!ctx || typeof ctx !== "object") {
		return "<visit_context>\nNo visitor context available for this request.\n</visit_context>";
	}

	const lines: string[] = ["<visit_context>"];

	if (typeof ctx.hour === "number" && ctx.hour >= 0 && ctx.hour <= 23) {
		const timeStr = `${String(ctx.hour).padStart(2, "0")}:00`;
		const dayName =
			typeof ctx.dayOfWeek === "number" && ctx.dayOfWeek >= 0 && ctx.dayOfWeek <= 6
				? DAY_NAMES[ctx.dayOfWeek]
				: null;
		const weekendTag = ctx.isWeekend ? " (weekend)" : "";
		lines.push(
			dayName
				? `- Visitor's local time: roughly ${timeStr} on ${dayName}${weekendTag}.`
				: `- Visitor's local time: roughly ${timeStr}.`,
		);
	}

	if (typeof ctx.timeOfDay === "string" && ctx.timeOfDay.length > 0) {
		lines.push(`- Time of day: ${ctx.timeOfDay.replace(/_/g, " ")}.`);
	}

	if (typeof ctx.mood === "string" && ctx.mood.length > 0) {
		lines.push(`- Your current mood: ${ctx.mood}.`);
	}

	if (ctx.isFirstVisit === true) {
		lines.push("- This is the visitor's first visit.");
	} else if (typeof ctx.visitCount === "number" && ctx.visitCount > 1) {
		lines.push(`- This is the visitor's visit #${ctx.visitCount}.`);
		if (
			typeof ctx.minutesSinceLastVisit === "number" &&
			ctx.minutesSinceLastVisit >= 0
		) {
			lines.push(
				`- Time since last visit: ${formatRelative(ctx.minutesSinceLastVisit)}.`,
			);
		}
	}

	lines.push("</visit_context>");
	return lines.join("\n");
}

// Rate limiting configuration
const RATE_LIMIT_MAX = 50; // Max messages per day per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 24; // 24 hours in seconds

function getClientIP(req: VercelRequest): string {
	// Vercel provides the real client IP in these headers
	const forwarded = req.headers["x-forwarded-for"];
	if (forwarded) {
		const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
		return ip.trim();
	}
	const realIp = req.headers["x-real-ip"];
	if (realIp) {
		return Array.isArray(realIp) ? realIp[0] : realIp;
	}
	return "unknown";
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
	const key = `ratelimit:${ip}`;

	try {
		const count = await kv.get<number>(key) || 0;

		if (count >= RATE_LIMIT_MAX) {
			return { allowed: false, remaining: 0 };
		}

		// Increment counter and set expiry if new key
		const newCount = await kv.incr(key);
		if (newCount === 1) {
			// First request - set expiry
			await kv.expire(key, RATE_LIMIT_WINDOW);
		}

		return { allowed: true, remaining: RATE_LIMIT_MAX - newCount };
	} catch (error) {
		// If KV fails, allow the request but log error
		console.error("Rate limit check failed:", error);
		return { allowed: true, remaining: RATE_LIMIT_MAX };
	}
}

export default async function handler(
	req: VercelRequest,
	res: VercelResponse,
) {
	if (req.method === "OPTIONS") {
		res.status(200).end();
		return;
	}

	if (req.method !== "POST") {
		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	// Check server-side rate limit
	const clientIP = getClientIP(req);
	const { allowed, remaining } = await checkRateLimit(clientIP);

	// Add remaining count to response headers
	res.setHeader("X-RateLimit-Remaining", remaining.toString());

	if (!allowed) {
		res.status(429).json({ error: "rate_limited", remaining: 0 });
		return;
	}

	const { message, history = [], context } = req.body as {
		message?: string;
		history?: { role: string; content: string }[];
		context?: VisitContextPayload;
	};

	if (!message || typeof message !== "string") {
		res.status(400).json({ error: "Message is required" });
		return;
	}

	try {
		const messages = [
			...history.map((msg) => ({
				role: msg.role as "user" | "assistant",
				content: msg.content,
			})),
			{ role: "user" as const, content: message },
		];

		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.setHeader("Transfer-Encoding", "chunked");

		const stream = anthropic.messages.stream({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1024,
			// Prompt caching: the PROMETHEUS system prompt is static and ~17KB.
			// Marking it cache-eligible cuts input token cost ~90% on repeat calls
			// within the 5-min TTL. The visit-context block is placed AFTER the
			// cache breakpoint on purpose — it stays fresh each request without
			// invalidating the cached static prefix.
			system: [
				{
					type: "text",
					text: getSystemPrompt(),
					cache_control: { type: "ephemeral" },
				},
				{
					type: "text",
					text: buildVisitContextBlock(context),
				},
			],
			messages,
		});

		for await (const event of stream) {
			if (
				event.type === "content_block_delta" &&
				event.delta.type === "text_delta"
			) {
				res.write(event.delta.text);
			}
		}

		res.end();
	} catch (error) {
		console.error("Claude API error:", error);

		// Check for specific Anthropic API errors
		const apiError = error as { status?: number; error?: { type?: string } };

		if (apiError.status === 429) {
			// Rate limited
			res.status(429).json({ error: "rate_limited" });
			return;
		}

		if (apiError.status === 400 && apiError.error?.type === "invalid_request_error") {
			// Could be billing/quota issue
			res.status(402).json({ error: "quota_exceeded" });
			return;
		}

		if (apiError.status === 401 || apiError.status === 403) {
			// API key issues
			res.status(402).json({ error: "quota_exceeded" });
			return;
		}

		res.status(500).json({ error: "server_error" });
	}
}
