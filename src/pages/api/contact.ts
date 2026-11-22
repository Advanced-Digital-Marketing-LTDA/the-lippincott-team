import type { APIRoute } from 'astro';
import { clientIp, createRateLimiter, jsonError, readBody, type BodyResult } from '../../lib/api-guards';
import { listPages, type ContactFormBlock } from '../../lib/data';
import {
	ContactValidationError,
	DEFAULT_INTEREST_OPTIONS,
	forwardContactLead,
	interestOptionValues,
} from '../../lib/sierra-contact';

// Host-neutral contact endpoint: the contact form POSTs here and the lead is
// forwarded to Sierra directly, identically on every host (Netlify, Coolify/
// Docker, the standalone Node server, local dev). This replaced the old
// Netlify Forms + netlify/functions/contact-sierra.ts flow, which only worked
// on Netlify.
export const prerender = false;

const THANK_YOU_URL = '/contact-us/thank-you/';

// The form payload is name/email/phone/interest/message — 32 KiB is generous.
const MAX_BODY_BYTES = 32 * 1024;
// Best-effort, single-instance abuse guard (Netlify's Akismet spam filtering
// no longer applies to this path). 5 submissions per IP per 10 minutes is
// plenty for humans; the limiter keys on the proxy-set client IP (see
// clientIp in src/lib/api-guards.ts).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_WINDOW_CAP = 5000;
const isRateLimited = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, RATE_WINDOW_CAP);

function thankYou() {
	return new Response(null, { status: 303, headers: { Location: THANK_YOU_URL } });
}

// The "I want to" select submits "<leadType>|<label>" pairs. Validate them
// against the options the forms actually render — contactForm blocks can be
// placed on any page, so the allowed set is the union across every page doc
// (the built-in defaults when none are configured). Results are cached
// briefly so each POST doesn't re-query Tina; a failed lookup is NOT cached,
// so a transient error can't permanently reject valid CMS options.
const INTERESTS_CACHE_MS = 5 * 60 * 1000;
let allowedInterestsValues: ReadonlySet<string> | null = null;
let allowedInterestsAt = 0;
let allowedInterestsPromise: Promise<ReadonlySet<string>> | null = null;

/** Load the union of choices rendered by every form, including per-form defaults. */
async function loadInterestOptions() {
	const options = (await listPages())
		.flatMap((page) => page.blocks ?? [])
		.filter((block): block is ContactFormBlock => block?.__typename === 'PageBlocksContactForm')
		.flatMap<{ label: string; leadType: string }>((block) => {
			const edited = (block.interestOptions ?? []).flatMap((o) =>
				o?.label?.trim() && o.leadType ? [{ label: o.label.trim(), leadType: o.leadType }] : []);
			return edited.length > 0 ? edited : DEFAULT_INTEREST_OPTIONS;
		});
	return interestOptionValues(options.length > 0 ? options : DEFAULT_INTEREST_OPTIONS);
}

/** Deduplicate refreshes and preserve last-good choices when Tina is temporarily unavailable. */
function allowedInterests() {
	if (allowedInterestsValues && Date.now() - allowedInterestsAt < INTERESTS_CACHE_MS) {
		return Promise.resolve(allowedInterestsValues);
	}
	allowedInterestsPromise ??= loadInterestOptions()
		.then((values) => {
			allowedInterestsValues = values;
			allowedInterestsAt = Date.now();
			return values;
		})
		.catch(() => allowedInterestsValues ?? interestOptionValues(DEFAULT_INTEREST_OPTIONS))
		.finally(() => {
			allowedInterestsPromise = null;
		});
	return allowedInterestsPromise;
}

// Origins allowed to POST the contact form from a browser. SITE_URL is the
// canonical origin on every host; the platform URL envs cover deploy previews
// (Netlify's per-deploy origins come from DEPLOY_PRIME_URL/DEPLOY_URL — its
// URL var stays the production address on previews — Coolify/Cloudflare set
// theirs); CONTACT_ALLOWED_ORIGINS is a comma-separated list of extra origins
// for hosts no platform var expresses — a Bunny edge hostname
// (https://<zone>.b-cdn.net) or a second custom domain in front of the same
// app, for example. The brand's own domains and the localhost ports are
// hardcoded below: the canonical thelippincottteam.com pair, plus the old
// lippincottteam.com pair while that domain is being transitioned over. Requests with no Origin header (curl
// and other non-browser clients) are allowed through — the honeypot, size
// cap, and rate limit remain the controls for them. This endpoint-level check
// exists because astro.config.mjs keeps `security.checkOrigin` disabled:
// Bunny CDN rewrites the Host header sent to the origin and does not forward
// the visitor host, so Astro's host-based guard would reject every browser
// POST.
function originAllowed(request: Request) {
	const origin = request.headers.get('origin');
	if (!origin) return true;
	const allowed = [
		process.env.SITE_URL,
		process.env.URL,
		process.env.DEPLOY_PRIME_URL,
		process.env.DEPLOY_URL,
		process.env.COOLIFY_URL,
		process.env.CF_PAGES_URL,
		// Extra origins (comma-separated) that host the same app — staging
		// Bunny/CDN hostnames, a www alias served without a redirect, etc.
		...(process.env.CONTACT_ALLOWED_ORIGINS ?? '').split(','),
	];
	for (const value of allowed) {
		if (!value) continue;
		try {
			if (new URL(value.trim()).origin === origin) return true;
		} catch {
			// Ignore malformed env values and keep checking the rest.
		}
	}
	// Brand domains (hardcoded, like the localhost ports): the canonical
	// thelippincottteam.com domain and its www alias may serve the site or
	// carry a visitor's Origin. The old lippincottteam.com pair stays while
	// that domain transitions to thelippincottteam.com — drop it once the
	// cutover completes.
	return (
		origin === 'https://thelippincottteam.com' ||
		origin === 'https://www.thelippincottteam.com' ||
		origin === 'https://lippincottteam.com' ||
		origin === 'https://www.lippincottteam.com' ||
		origin === 'http://localhost:4321' ||
		origin === 'http://localhost:4322'
	);
}

// Parses the POST body into string fields and enforces the character cap.
// formData() rejects malformed multipart bodies and unsupported content
// types — treated as a client error (400) rather than a 500.
async function parseContactForm(
	request: Request,
	body: BodyResult,
): Promise<{ kind: 'error'; response: Response } | { kind: 'ok'; data: Record<string, string> }> {
	if (body.kind === 'error') return body;
	const contentType = request.headers.get('content-type') ?? 'application/x-www-form-urlencoded';
	let formData: FormData;
	try {
		formData = await new Request(request.url, {
			method: 'POST',
			headers: { 'content-type': contentType },
			body: body.buffer,
		}).formData();
	} catch {
		return { kind: 'error', response: jsonError(400, 'Invalid form submission.') };
	}
	const data: Record<string, string> = {};
	let totalChars = 0;
	for (const [key, value] of formData.entries()) {
		// The form only ever submits strings — a File part means a crafted
		// multipart upload, which the size cap alone does not constrain.
		if (typeof value !== 'string') {
			return { kind: 'error', response: jsonError(400, 'Invalid form submission.') };
		}
		data[key] = value;
		totalChars += value.length;
	}
	// Second layer (character count) on top of the byte cap.
	if (totalChars > MAX_BODY_BYTES) {
		return { kind: 'error', response: jsonError(413, 'Your message is too long. Please shorten it and try again.') };
	}
	return { kind: 'ok', data };
}

// reCAPTCHA v3 server check. Enforced only when RECAPTCHA_SECRET_KEY is set, so
// local dev and unconfigured hosts keep working. Fails closed on any Google error.
const RECAPTCHA_MIN_SCORE = 0.5;
async function recaptchaPassed(token: string | undefined, secret: string) {
	if (!token) return false;
	try {
		const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
			method: 'POST',
			body: new URLSearchParams({ secret, response: token }),
		});
		const result = await response.json();
		return result.success === true && result.action === 'contact' && result.score >= RECAPTCHA_MIN_SCORE;
	} catch {
		return false;
	}
}

// Reference the exact key, never bare `import.meta.env`: Vite would inline the whole
// object, including private .env values, into the server bundle. Plain Node has no
// import.meta.env (the route tests), so that throws and falls back to process.env.
function buildTimeSiteKey() {
	try {
		return import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY;
	} catch {
		return undefined;
	}
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
	// Browser CSRF guard first: reject cross-origin form posts before they
	// consume rate-limit budget or touch Sierra.
	if (!originAllowed(request)) {
		return jsonError(403, 'Cross-origin form submissions are not allowed.');
	}

	if (isRateLimited(clientIp(request, clientAddress), Date.now())) {
		return jsonError(429, 'Too many requests. Please wait a few minutes, or call or text us directly.');
	}

	const body = await readBody(request, MAX_BODY_BYTES, 'Your message is too long. Please shorten it and try again.');
	const parsed = await parseContactForm(request, body);
	if (parsed.kind === 'error') return parsed.response;
	const data = parsed.data;

	// Honeypot: humans never fill the hidden bot-field. Fake success (as
	// Netlify's spam filter did) so bots learn nothing.
	if (data['bot-field']?.trim()) return thankYou();

	if (data['form-name'] !== 'contact') {
		return jsonError(400, 'Unknown form.');
	}

	const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
	// The site key is inlined at build time (process.env is the test/dev fallback). A secret
	// without it means this build's form can never send a token, so skip rather than drop every lead.
	const recaptchaSiteKey = buildTimeSiteKey() || process.env.PUBLIC_RECAPTCHA_SITE_KEY;
	if (recaptchaSecret && !recaptchaSiteKey) {
		console.error('[contact] RECAPTCHA_SECRET_KEY is set but this build has no PUBLIC_RECAPTCHA_SITE_KEY; skipping reCAPTCHA. Rebuild with the site key.');
	} else if (recaptchaSecret && !(await recaptchaPassed(data['g-recaptcha-response'], recaptchaSecret))) {
		return jsonError(400, "We couldn't verify your submission. Please try again, or call or text us directly.");
	}

	const apiKey = process.env.SIERRA_API_KEY;
	if (!apiKey) {
		console.error('[sierra-contact] SIERRA_API_KEY is not configured.');
		return jsonError(500, 'The contact form is not configured on this server.');
	}

	try {
		await forwardContactLead(data, apiKey, fetch, await allowedInterests());
	} catch (error) {
		if (error instanceof ContactValidationError) {
			return jsonError(400, error.message);
		}
		// Sierra outages / network failures are server errors; don't leak
		// Sierra response details to the client (they're logged below).
		console.error('[sierra-contact] Lead creation failed.', error instanceof Error ? error.message : 'Unknown error');
		return jsonError(500, "We couldn't send your request. Please try again, or call or text us directly.");
	}

	return thankYou();
};
