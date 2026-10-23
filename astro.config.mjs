// @ts-check
import { defineConfig } from 'astro/config';
import { parseCdnConfig } from './scripts/cdn-config.mjs';
import { loadEnv } from 'vite';

// Match Vite's active env files, including .env.production(.local), before
// validating build settings. Existing shell/host values retain precedence.
Object.assign(process.env, loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''));

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tina from '@tinacms/astro/integration';
import { tinaAdminDevRedirect } from '@tinacms/astro/vite';
import tailwindcss from '@tailwindcss/vite';

// Fail before adapter/content compilation when a build is misconfigured.
parseCdnConfig(process.env);

// Host-neutral: every content page prerenders to static HTML, and the one
// on-demand route (/tina-island, the visual-editing endpoint) is served by
// whichever host built the site. Each platform sets its own build env var
// automatically — nothing to configure — and any other host (including a
// local `wrangler deploy`) falls back to a portable Node server. Set
// DEPLOY_ADAPTER to force a specific adapter when no env var applies.
async function getAdapter() {
	const vercel = async () => (await import('@astrojs/vercel')).default();
	const cloudflare = async () => (await import('@astrojs/cloudflare')).default();
	const netlify = async () => (await import('@astrojs/netlify')).default();
	const nodeStandalone = async () =>
		(await import('@astrojs/node')).default({ mode: 'standalone' });

	switch (process.env.DEPLOY_ADAPTER) {
		case 'vercel': return vercel();
		case 'cloudflare': return cloudflare();
		case 'netlify': return netlify();
		case 'node': return nodeStandalone();
		case undefined: break; // no override -> auto-detect below
		default:
			console.warn(`[astro.config] Unknown DEPLOY_ADAPTER "${process.env.DEPLOY_ADAPTER}" - ignoring and auto-detecting.`);
	}
	if (process.env.VERCEL) return vercel();
	// CF_PAGES = Cloudflare Pages CI; WORKERS_CI = Cloudflare Workers Builds CI.
	if (process.env.WORKERS_CI || process.env.CF_PAGES) return cloudflare();
	if (process.env.NETLIFY) return netlify();

	return nodeStandalone();
}

// Prefer an explicit SITE_URL; otherwise use the URL the platform injects so
// zero-config deploys still emit absolute URLs (sitemap, RSS, OpenGraph).
// Cloudflare Workers exposes no such var — set SITE_URL there for correct
// canonicals. Coolify injects COOLIFY_URL for the app's first domain, but
// production Coolify deployments should still set SITE_URL explicitly (it
// wins here). Local builds fall back to localhost.
function getSiteUrl() {
	if (process.env.SITE_URL) return process.env.SITE_URL;
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	if (process.env.CF_PAGES_URL) return process.env.CF_PAGES_URL;
	if (process.env.NETLIFY && process.env.URL) return process.env.URL;
	if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;

	return 'http://localhost:4321';
}

// https://astro.build/config
export default defineConfig({
	site: getSiteUrl(),
	output: 'static',
	adapter: await getAdapter(),
	// The site is fronted by Bunny CDN, whose pull zone rewrites the Host
	// header sent to the origin (Origin Host Header = the app's own domain,
	// so Coolify's Traefik routes correctly) and does not forward the visitor
	// host via x-forwarded-host. Astro's same-origin guard for non-GET
	// requests would therefore reject every browser POST to /api/contact
	// (Origin: <cdn hostname> vs Host: <app domain>) and to /tina-island. The
	// endpoints carry no cookies/sessions (nothing for CSRF to exploit), but
	// /api/contact enforces its own browser CSRF guard at the endpoint level
	// (an Origin allowlist against SITE_URL / platform URL envs — see
	// src/pages/api/contact.ts) alongside the honeypot, streaming size cap,
	// and per-IP rate limit, and the island endpoint only re-renders publicly
	// visible content. So the host-based origin check stays disabled.
	security: {
		checkOrigin: false,
	},
	redirects: {
		'/home': '/',
		// Legacy WordPress URL (exact path). The `/opt-out-preferences/*`,
		// `/author/*`, `/buyers/*`, and `/sellers/*` families are handled by
		// host-neutral redirect endpoints under src/pages/<prefix>/[...slug].ts
		// (mirrored in public/_redirects, which Netlify's CDN reads directly).
		'/team-member-page-design/': { status: 301, destination: '/about/' },
		// Legacy WordPress image path; the asset now lives in Astro's public/uploads directory.
		'/wp-content/uploads/2026/04/townelake2.jpg': { status: 301, destination: '/uploads/2026/04/townelake2.jpg' },
		// Cimarron community guide was unpublished (the team does not sell
		// there); send the old URL to the Katy guide so indexed links do not 404.
		'/northwest-houston-real-estate/katy-tx-real-estate/cimarron-real-estate/': { status: 301, destination: '/northwest-houston-real-estate/katy-tx-real-estate/' },
	},
	// Astro 7 changed the default from `true` (HTML-aware: keep a single space
	// between inline elements) to `'jsx'` (strip whitespace per JSX rules,
	// which can glue adjacent inline elements together). Pin the v6 behavior.
	compressHTML: true,
	integrations: [mdx(), sitemap(), icon(), tina()],
	build: {
		// Inline the (~10 KiB) bundled CSS into a <style> in <head> instead of a
		// separate render-blocking <link>. Astro's default ('auto') only inlines
		// stylesheets under ~4 KiB, leaving ours blocking first paint on mobile.
		inlineStylesheets: 'always',
	},
	// Tina Cloud rewrites CMS image src to assets.tina.io; let Astro
	// fetch those URLs at build time so <Image> can transcode + resize them.
	image: {
		// Astro 6 responsive images: auto-emit srcset so the browser picks a
		// variant matched to the rendered box + DPR, not the full intrinsic size.
		layout: 'constrained',
		remotePatterns: [{ protocol: 'https', hostname: 'assets.tina.io' }],
	},
	vite: {
		plugins: [tailwindcss(), tinaAdminDevRedirect()],
		// Bundle @tinacms/astro into the SSR build instead of resolving it
		// per-module on every cold request — otherwise each
		// `import TinaMarkdown from '@tinacms/astro/TinaMarkdown.astro'`
		// triggers a full Vite resolve + Astro-plugin compile of the
		// package's source `.astro` files on the first request.
		ssr: {
			noExternal: ['@tinacms/astro', '@tinacms/bridge'],
		},
		build: {
			rollupOptions: {
				onwarn(warning, warn) {
					if (warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
						warning.exporter === 'tinacms/dist/client') {
						return;
					}
					warn(warning);
				}
			}
		}
	}
});
