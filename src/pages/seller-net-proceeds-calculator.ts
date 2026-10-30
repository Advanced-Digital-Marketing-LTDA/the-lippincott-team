import type { APIRoute } from 'astro';

// Keep the original calculator URL working on non-Netlify hosts.
export const prerender = false;

export const ALL: APIRoute = ({ url, redirect }) =>
	redirect(`/sell/seller-net-proceeds-calculator/${url.search}`, 301);
