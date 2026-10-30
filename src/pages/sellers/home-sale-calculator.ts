import type { APIRoute } from 'astro';

// Exact historical calculator URL; takes precedence over sellers/[...slug].ts.
// Keep queries on every adapter; mirrored in public/_redirects.
export const prerender = false;

export const ALL: APIRoute = ({ url, redirect }) =>
	redirect(`/sell/seller-net-proceeds-calculator/${url.search}`, 301);
