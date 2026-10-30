import type { APIRoute } from 'astro';

// Exact historical listing search form. Keep queries on every adapter; mirrored in public/_redirects.
export const prerender = false;

export const ALL: APIRoute = ({ url, redirect }) =>
	redirect(`https://northwest-houston-ai-home-search.thelippincottteam.com/${url.search}`, 301);
