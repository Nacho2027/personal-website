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

	const { message, history = [] } = req.body;

	if (!message || typeof message !== "string") {
		res.status(400).json({ error: "Message is required" });
		return;
	}

	try {
		const messages = [
			...history.map((msg: { role: string; content: string }) => ({
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
			system: getSystemPrompt(),
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
